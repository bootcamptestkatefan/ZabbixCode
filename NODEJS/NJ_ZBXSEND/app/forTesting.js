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
    console.log(' ');
    console.log('Goes to resourceHealthApiUtil');
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
    console.log(' ');
    console.log('resourceHealth.js');
    console.log('****************************************************************');
    var alertData = req.body.data;
    var alertStatus = alertData.status||alertData.Status;
    var alertContext = alertData.context||alertData.Context;
    var alertActivityLog = alertContext.activityLog||alertContext.ActivityLog;
    var alertEventTimeStamp = alertActivityLog.eventTimestamp||alertActivityLog.eventTimestamp;
    var alertLevel = alertActivityLog.level||alertActivityLog.Level;
    var alertProperties = alertActivityLog.properties||alertActivityLog.Properties;

    var alertCurrentHealthStatus = alertProperties.currentHealthStatus||alertProperties.CurrentHealthStatus;
    var alertPreviousHealthStatus = alertProperties.previousHealthStatus||alertProperties.PreviousHealthStatus;

    var alertResourceId = alertActivityLog.resourceId||alertActivityLog.ResourceId;
    var alertResourceGroupName = alertActivityLog.resourceGroupName||alertActivityLog.ResourceGroupName;
    var alertName = alertResourceId.substring(alertResourceId.lastIndexOf('/')+1)+" is now "+alertCurrentHealthStatus;

    var alertResourceName = alertResourceId.substring(alertResourceId.lastIndexOf('/')+1); //getting the VM name from resourceID

    // console.log('alertData: ' + alertData);
    // console.log('alertStatus: ' + alertStatus);
    // console.log('alertContext: ' + alertContext);
    // console.log('alertActivityLog: ' + alertActivityLog);
    // console.log('alertEventTimeStamp: ' + alertEventTimeStamp);
    // console.log('alertLevel: ' + alertLevel);
    // console.log('alertProperties: ' + alertProperties);
    // console.log('alertCurrentHealthStatus: ' + alertCurrentHealthStatus);
    // console.log('alertPreviousHealthStatus: ' + alertPreviousHealthStatus);
    // console.log('alertResourceId: ' + alertResourceId);
    // console.log('alertResourceGroupName: ' + alertResourceGroupName);
    // console.log('alertName: ' + alertName);
    // console.log('alertResourceName: '+alertResourceName);

    var hash = crypto.createHash('md5').update(alertResourceId).digest('hex'); //for authentication https://www.dotnetcurry.com/nodejs/1237/digest-authentication-nodejs-application
    console.log('hash: '+hash)

    var host = alertResourceGroupName+' - '+alertResourceName;
    console.log('host: '+host);

    var itemKey = "custom.key."+hash;
    console.log('itemKey: '+itemKey);

    var alertMessage = '['+alertStatus+']['+alertResourceGroupName+']['+alertLevel+']['
                 +alertResourceName+' Current_Health_Status: '+alertCurrentHealthStatus+' Previous_Health_Status: '+alertPreviousHealthStatus+'][Time: '+alertEventTimeStamp+']';     
    console.log('alertMessage: '+alertMessage);                      
    
    var alertSeverity;
    if(alertLevel == 'Verbose'){ alertSeverity = '5'; }
    else if(alertLevel == 'Informational'){ alertSeverity = '4'; }
    else if(alertLevel == 'Warning'){ alertSeverity = '3'; }
    else if(alertLevel == 'Error'){ alertSeverity = '2';  }
    else if(alertLevel == 'Critical') { alertSeverity = '1'; }
    else{
        console.log('Error - Invalid severity');
    }
    console.log('alertSeverity: '+alertSeverity);

    var triggerExpression = "{"+host+":"+itemKey+".regexp(\\\[S"+alertSeverity+"\\\])}>0 and {"
                            +host+":"+itemKey+".regexp(\\\[Deactivated\\\])}=0";
    console.log('triggerExpression: '+triggerExpression);

    const priority = 5-alertSeverity;
    console.log('priority: '+priority);

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