'use strict'
var crypto = require('crypto');
var util = require('./util/zabbixApiUtil');
var config = require('./devconfig/zbxsend-config.json');

const zabbixAccount = config.zabbixAccount;
const zabbixPassword = config.zabbixPassword;
/*
    Detail      :   1) Login to Zabbix by calling function userLogin. Pass the result to 2) by callback.
                    2) Check host group by calling function checkHostGroup. Pass the result to 3) by callback.
                    3) Check host by calling function checkHost. Pass the result to 4) by callback.
                    4) Check item by calling function check item. Pass the result to 5) by callback.
                    5) Check trigger by calling function check trigger. Pass the result to 6) by callback.
                    6) Logout from Zabbix.
                    7) Call the callback function with result
                    8) Return the value return by the callback function
*/
function checkZabbixItemMetric(hostGroupName,host,itemName,itemKey,triggerExpression,triggerPriority,callback){
    console.log(' ');
    console.log('Goes to prometheus');
    console.log('****************************************************************');
    util.userLogin(zabbixAccount,zabbixPassword,function(authToken){
        util.checkHostGroup(authToken,hostGroupName,function(hostGroupId){
            util.checkHost(authToken,host,hostGroupId,function(hostId){
                util.checkItem(authToken,hostId,itemName,itemKey,function(itemId){
                    util.checkTrigger(authToken,itemName,triggerExpression,triggerPriority,function(result){
                        util.userLogout(authToken);
                        return callback(result);
                    });
                });
            })
        });
    });
}

function handleAlert(req, res, timer) {

    var alertAlerts = req.body.alerts;
    var alertFoundationName = req.body.externalURL.split('.')[2];
    var alertLabels = alertAlerts[0].labels||alertAlerts[0].Labels;
    var alertAnnotations = alertAlerts[0].annotations||alertAlerts[0].Annotations;
    var alertStartsAt = alertAlerts[0].startsAt||alertAlerts[0].StartsAt;
    var alertSummary = alertAnnotations.summary||alertAnnotations.Summary;
    var alertLevel = alertLabels.severity||alertLabels.Severity;

    var alertStatus;
    if(alertAlerts[0].status == 'firing'){alertStatus = 'Active';}
    else {alertStatus = alertAlerts[0].status;}

    var alertName = alertSummary;
    var hash = crypto.createHash('md5').update(alertName).digest('hex'); //for authentication https://www.dotnetcurry.com/nodejs/1237/digest-authentication-nodejs-application
    var host = alertFoundationName;
    var itemKey = "custom.key."+hash;
    
    var alertSeverity;
    if(alertLevel == 'verbose'){ alertSeverity = '5'; }
    else if(alertLevel == 'informational'){ alertSeverity = '4'; }
    else if(alertLevel == 'warning'){ alertSeverity = '3'; }
    else if(alertLevel == 'error'){ alertSeverity = '2';  }
    else if(alertLevel == 'critical') { alertSeverity = '1'; }
    else{
        console.log('Error - Invalid severity');
    }
    const priority = 5-alertSeverity;
    
    var alertMessage = '['+alertStatus+']['+alertName+'][S'+alertSeverity+'][Time: '+alertStartsAt+']';     
                   
    var triggerExpression = "{"+host+":"+itemKey+".regexp(\\\[S"+alertSeverity+"\\\])}>0 and {"
                            +host+":"+itemKey+".regexp(\\\[resolved\\\])}=0";


    checkZabbixItemMetric("Pivotal Cloud Foundry",host,alertName,itemKey,triggerExpression,priority,function(result){
        if(!result){ //new trigger can be made
            console.log('New trigger is made');  
            console.log('Please wait for 45s to make the trigger-making');           
            res.sendStatus(200);
            //Delay 45 seconds if it is a new alert
            timer(45000).then(_=>
                util.sendZabbixItem(host,itemKey,alertMessage,function respose(result){
            })
            );
        }else{ //new trigger cannot be made
            console.log('No new trigger is made');
            util.sendZabbixItem(host,itemKey,alertMessage,function respose(result){
                res.json(result);
            });                                
        }
    });

    console.log(' ');
    console.log('Print Parameter');
    console.log('****************************************************************');

    console.log('alertAlerts:              ' + alertAlerts);
    console.log('alertFoundationName:      ' + alertFoundationName);
    console.log('alertLabels:              ' + alertLabels);
    console.log('alertAnnotations:         ' + alertAnnotations);
    console.log('alertStartsAt:            ' + alertStartsAt);
    console.log('alertSummary:             ' + alertSummary);
    console.log('alertLevel:               ' + alertLevel);
    console.log('alertStatus:              ' + alertStatus);
    console.log('alertName:                ' + alertName);

    console.log('hash:                     ' + hash);
    console.log('host:                     ' + host);
    console.log('itemKey:                  ' + itemKey);
    console.log('alertSeverity:            ' + alertSeverity);
    console.log('alertMessage:             ' + alertMessage);
    console.log('triggerExpression:        ' + triggerExpression);
    console.log('priority:                 ' + priority);

    console.log('****************************************************************');
    console.log(' ');

}

module.exports = {
	handleAlert
}