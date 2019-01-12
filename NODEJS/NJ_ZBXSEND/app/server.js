'use strict';

var express = require('express');
//var app = express();
var app = express().use(express.json());

//var config = require('./config/zbxsend-config.json');
var config = require('./devconfig/zbxsend-config.json');

var metricAlert = require('./metricAlert');

/* 
    config is getting from "./devconfig/zbxsend-config.json" 
    webHookPort is defined inside this config file
*/
app.listen(config.webHookPort,() => console.log('Webhook is listening on port '+config.webHookPort));

/*
    URL         :   http://<this_host>:<config.webHookPort>/azureMetricAlert, 
    Reponse     :   200 / Result of sending Zabbix item
    Detail      :   1) Get input parameters from request
                    2) Check Zabbix item by calling function checkZabbixItem
                        2.1) If do not have result (is new alert)
                            2.1.1) Send response with status 200
                            2.1.2) Wait 45 seconds
                            2.1.3) Send Zabbix item by calling function sendZabbixItem
                        2.2) If have result (is not new alert)
                            2.2.1) Send Zabbix item by calling function sendZabbixItem
                            2.2.2) Response result of sending Zabbix item
*/

const timer = ms => new Promise( res => setTimeout(res, ms));

var handleAlertFunc = [];
handleAlertFunc['AzureMonitorMetricAlert'] = metricAlert.handleAlert;
//handleAlertFunc['AzureMonitorResourceHealth'] = resourceHealth.handleAlert;

app.post('/azureMetricAlert',(req,res) => {
    //
    /*
        1. GetSchema ID from request body
        2. 
    */
    var alertSchemaId = req.body.schemaId;
    var func = handleAlertFunc[alertSchemaId];
    if (func) {
        func(req, res, timer);
    } else {
        console.log('Error - New Alert Type, please find admin for help');
    }

});

