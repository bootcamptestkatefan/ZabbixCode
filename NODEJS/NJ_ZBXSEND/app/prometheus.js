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

    var alertAlerts = req.body.alerts;
    var alertLabels = alertAlerts[0].labels||alertAlerts[0].Labels;
    var alertAnnotations = alertAlerts[0].annotations||alertAlerts[0].Annotations;
    var alertFoundationName = alertLabels.environment;
    var alertStartsAt = alertAlerts[0].startsAt||alertAlerts[0].StartsAt;
    var alertSummary = alertAnnotations.summary||alertAnnotations.Summary;
    var alertDescription = alertAnnotations.description||alertAnnotations.Description;
    var alertLevel = alertLabels.severity||alertLabels.Severity;
    var status = alertAlerts[0].status||alertAlerts[0].Status;

    var alertStatus;
    if(status == 'firing'){ alertStatus = 'Active'; }
    else{ alertStatus = 'Resolved';}

    var itemName = alertSummary;
    var editedItemName = itemName.split("/").slice(3).join("/");

    var alertSeverity;
    if(alertLevel == 'indeterminate'){ alertSeverity = '6'; }
    else if(alertLevel == 'informational'){ alertSeverity = '5'; }
    else if(alertLevel == 'warning'){ alertSeverity = '4'; }
    else if(alertLevel == 'minor'){ alertSeverity = '3';  }
    else if(alertLevel == 'major'){ alertSeverity = '3';  }
    else if(alertLevel == 'critical'){ alertSeverity = '2'; }
    else if(alertLevel == 'fatal'){ alertSeverity = '1'; }
    else{ console.log('Error - Invalid severity'); }
    const priority = 6-alertSeverity;

    var host = alertFoundationName;
    var itemHash = crypto.createHash('md5').update(itemName).digest('hex');
    var itemKey = "custom.key."+itemHash;
    
    var alertMessage = '['+alertStatus+']'+editedItemName+'[S'+alertSeverity+']'; 
    var triggerExpression = "{"+host+":"+itemKey+".regexp(\\\[S"+alertSeverity+"\\\])}>0 and {"
                            +host+":"+itemKey+".regexp(\\\[Resolved\\\])}=0";


    checkZabbixItemMetric("Pivotal Cloud Foundry",host,itemName,itemKey,triggerExpression,priority,function(result){
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
            util.sendZabbixItem(host,itemKey,alertMessage,function respose(result){
                res.json(result);
            });                                
        }
    });

    console.log(' ');
    console.log('Print Parameter');
    console.log('****************************************************************');     
    console.log(' ');                                          
    console.log('alertAlerts :                            ' + alertAlerts);      
    console.log('alertLabels :                            ' + alertLabels);      
    console.log('alertAnnotations :                       ' + alertAnnotations);
    console.log(' ');
    console.log('alertFoundationName :                    ' + alertFoundationName);            
    console.log('alertStartsAt :                          ' + alertStartsAt);        
    console.log('alertSummary :                           ' + alertSummary);       
    console.log('alertDescription :                       ' + alertDescription);           
    console.log('alertLevel :                             ' + alertLevel);     
    console.log('status :                                 ' + status); 
    console.log(' ');                                                 
    console.log('alertStatus :                            ' + alertStatus);       
    console.log('itemName :                               ' + itemName); 
    console.log('editedItemName :                         ' + editedItemName);
    console.log(' ');                                               
    console.log('alertSeverity :                          ' + alertSeverity);        
    console.log('alertLevel :                             ' + alertLevel);     
    console.log('priority :                               ' + priority); 
    console.log(' ');                                             
    console.log('host :                                   ' + host);
    console.log('itemHash :                               ' + itemHash);   
    console.log('itemKey :                                ' + itemKey);        
    console.log(' ');                                             
    console.log('alertMessage :                           ' + alertMessage);       
    console.log('triggerExpression :                      ' + triggerExpression); 
    console.log('****************************************************************');
    console.log(' ');
    
}

module.exports = {
    handleAlert
}