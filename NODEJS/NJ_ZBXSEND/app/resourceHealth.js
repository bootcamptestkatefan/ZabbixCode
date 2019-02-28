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
    util.userLogin(zabbixAccount,zabbixPassword,function(authToken){
        util.checkHostGroup(authToken,hostGroupName,function(hostGroupId){
            util.checkHost(authToken,host,hostGroupId,function(hostId){
                util.checkItem(authToken,hostId,itemName,itemKey,function(itemId){
                    util.checkTrigger(host,itemKey,authToken,triggerExpression,triggerPriority,function(result){
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
    var alertContext = alertData.context||alertData.Context;
    var alertActivityLog = alertContext.activityLog||alertContext.ActivityLog;
    var alertEventTimeStamp = alertActivityLog.eventTimestamp||alertActivityLog.eventTimestamp;
    var alertLevel = alertActivityLog.level||alertActivityLog.Level;
    var alertProperties = alertActivityLog.properties||alertActivityLog.Properties;
    var alertCurrentHealthStatus = alertProperties.currentHealthStatus||alertProperties.CurrentHealthStatus;
    var alertPreviousHealthStatus = alertProperties.previousHealthStatus||alertProperties.PreviousHealthStatus;
    var alertResourceId = alertActivityLog.resourceId||alertActivityLog.ResourceId;
    var alertResourceName = alertResourceId.substring(alertResourceId.lastIndexOf('/')+1);
    var alertResourceGroupName = alertActivityLog.resourceGroupName||alertActivityLog.ResourceGroupName;
    var status = alertActivityLog.status||alertActivityLog.Status;

    var alertStatus;
    if(status == 'Activated'){ alertStatus = 'Active'; }
    else{ alertStatus = 'Resolved';}


    var itemName;
    if (alertCurrentHealthStatus == "Unavailable"){  
        itemName = alertResourceName+" is now "+alertCurrentHealthStatus;//set alert name to "(VM name) is now Unavailable"
    }else if(alertCurrentHealthStatus == "Degraded"){  
        itemName = alertResourceName+" is now "+alertCurrentHealthStatus;//set alert name to "(VM name) is now Degraded"
    }else { 
        itemName = alertResourceName+" is now "+alertPreviousHealthStatus;//set alert name to "(VM name) is now Available"
    }

    var hash = crypto.createHash('md5').update(itemName).digest('hex');
    var host = alertResourceGroupName;
    var itemKey = "custom.key."+hash;
    
    var alertSeverity;
    if(alertLevel == 'Verbose'){ alertSeverity = '6'; }
    else if(alertLevel == 'Informational'){ alertSeverity = '5'; }
    else if(alertLevel == 'Warning'){ alertSeverity = '4'; }
    else if(alertLevel == 'Error'){ alertSeverity = '3';  }
    else if(alertLevel == 'Critical') { alertSeverity = '2'; }
    else{ console.log('Error - Invalid severity'); }
    const priority = 6-alertSeverity;
    
    var alertMessage = '['+alertStatus+']'+itemName+'! Current health status: '+alertCurrentHealthStatus+'[S'+alertSeverity+']';
              
    var triggerExpression = "{"+host+":"+itemKey+".regexp(\\\[S"+alertSeverity+"\\\])}>0 and {"
                            +host+":"+itemKey+".regexp(\\\[Resolved\\\])}=0";



    checkZabbixItemMetric("Azure Resources",host,itemName,itemKey,triggerExpression,priority,function(result){
        if(!result){ //new trigger can be made           
            res.sendStatus(200);
            //Delay 45 seconds if it is a new alert
            timer(45000).then(_=>
                util.sendZabbixItem(host,itemKey,alertMessage,function respose(result){
            })
            );
        }else{ //new trigger cannot be made
            util.sendZabbixItem(host,itemKey,alertMessage,function respose(result){
                res.json(result);
            });                                
        }
    });

    console.log(' ');
    console.log('Print Parameter');
    console.log('****************************************************************');
    console.log('alertData                                    ' + alertData);      
    console.log('alertContext                                 ' + alertContext);         
    console.log('alertActivityLog                             ' + alertActivityLog);             
    console.log('alertEventTimeStamp                          ' + alertEventTimeStamp);                
    console.log('alertLevel                                   ' + alertLevel);       
    console.log('alertProperties                              ' + alertProperties); 
        console.log(' ');           
    console.log('alertCurrentHealthStatus                     ' + alertCurrentHealthStatus);                     
    console.log('alertPreviousHealthStatus                    ' + alertPreviousHealthStatus);                      
    console.log('alertResourceId                              ' + alertResourceId);            
    console.log('alertResourceName                            ' + alertResourceName);              
    console.log('alertResourceGroupName                       ' + alertResourceGroupName);                   
    console.log('status                                       ' + status);   
    console.log('alertStatus                                  ' + alertStatus);  
        console.log(' ');     
    console.log('itemName                                     ' + itemName);  
        console.log(' ');   
    console.log('hash                                         ' + hash); 
    console.log('host                                         ' + host); 
    console.log('itemKey                                      ' + itemKey);
        console.log(' ');    
    console.log('alertSeverity                                ' + alertSeverity);          
    console.log('priority                                     ' + priority);   
        console.log(' ');  
    console.log('alertMessage                                 ' + alertMessage);         
    console.log('triggerExpression                            ' + triggerExpression);  
    console.log('****************************************************************');
    console.log(' ');

}

module.exports = {
    handleAlert
}