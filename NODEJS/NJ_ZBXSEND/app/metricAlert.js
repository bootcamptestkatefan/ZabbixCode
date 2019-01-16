'use strict'
var crypto = require('crypto');
var util = require('./util/zabbicApiUtil');
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
    var alertData = req.body.data;
    var alertStatus = alertData.status||alertData.Status;
    var alertContext = alertData.context||alertData.Context;
    var alertTimeStamp = alertContext.timestamp||alertContext.Timestamp;
    var alertCondition = alertContext.condition||alertContext.Condition;
    alertCondition = alertCondition.AllOf||alertCondition.allOf;
    var alertId = alertContext.id||alertContext.Id;

    var resourceGroupName = alertContext.resourceGroupName||alertContext.ResourceGroupName;
    var resourceName = alertContext.resourceName||alertContext.ResourceName;
    var alertName = alertContext.name||alertContext.Name;
    var alertSeverity = alertContext.severity||alertContext.Severity;
    var alertMetric = alertCondition[0]; //allof have two items

    var metricName = alertMetric.metricName||alertMetric.MetricName;
    var metricOperator = alertMetric.operator||alertMetric.Operator;
    var metricThreshold = alertMetric.threshold||alertMetric.Threshold;
    var metricValue = alertMetric.metricValue||alertMetric.MetricValue; //whyyyyyyyyy, metricValue not in allof's first item

    var hash = crypto.createHash('md5').update(alertId).digest('hex'); //for authentication https://www.dotnetcurry.com/nodejs/1237/digest-authentication-nodejs-application
    
    var host = resourceGroupName+' - '+resourceName;
    var itemKey = "custom.key."+hash;

    var alertMessage = '['+alertStatus+']['+resourceGroupName+']['
                 + alertName+'][S'+alertSeverity+']['+resourceName+' '+metricName+' '
                 + metricOperator+' '+metricThreshold+', current value: '
                 + metricValue+'][Time: '+alertTimeStamp+']';                           //yung lai joe d meh 
   
    var triggerExpression = "{"+host+":"+itemKey+".regexp(\\\[S"+alertSeverity+"\\\])}>0 and {"
                            +host+":"+itemKey+".regexp(\\\[Deactivated\\\])}=0";
    const priority = 5-alertSeverity;


    checkZabbixItemMetric("Azure Resources",host,alertName,itemKey,triggerExpression,priority,function(result){
        if(!result){ //new trigger can be made            
            console.log('New trigger is made');
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
}

module.exports = {
    handleAlert
}