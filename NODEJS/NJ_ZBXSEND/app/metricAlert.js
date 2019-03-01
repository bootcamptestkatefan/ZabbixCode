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
    var alertCondition = alertContext.condition||alertContext.Condition;
    var alertAllOf = alertCondition.AllOf||alertCondition.allOf;
    var alertMetric = alertAllOf[0];
    var resourceGroupName = alertContext.resourceGroupName||alertContext.ResourceGroupName;
    var resourceName = alertContext.resourceName||alertContext.ResourceName;
    // var alertSeverity = alertContext.severity||alertContext.Severity;
    var alertLevel = alertContext.severity||alertContext.Severity;
    var metricName = alertMetric.metricName||alertMetric.MetricName;
    var metricOperator = alertMetric.operator||alertMetric.Operator;
    var metricThreshold = alertMetric.threshold||alertMetric.Threshold;
    var metricValue = alertMetric.metricValue||alertMetric.MetricValue;

    var status = alertData.status||alertData.Status;
    var alertStatus;
    if(status == 'Activated'){ alertStatus = 'Active'; }
    else{ alertStatus = 'Resolved';}

    var itemName = resourceName+' '+metricName+' '+ metricOperator+' '+metricThreshold;
    var hash = crypto.createHash('md5').update(itemName).digest('hex'); 
    var host = resourceGroupName;
    var itemKey = "custom.key."+hash;

    var alertSeverity;
    if(alertLevel == '4'){ alertSeverity = '5'; }
    else if(alertLevel == '3'){ alertSeverity = '4'; }
    else if(alertLevel == '2'){ alertSeverity = '3';  }
    else if(alertLevel == '1') { alertSeverity = '2'; }
    else if(alertLevel == '0') { alertSeverity = '1'; }
    else{ console.log('Error - Invalid severity'); }
    // const priority = 5-alertSeverity;
    const priority = 6-alertSeverity;
    
    var alertMessage = '['+alertStatus+']'+itemName+', current value: '
                           + metricValue+'[S'+alertSeverity+']';
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
    console.log('alertData:                    ' + alertData);        
    console.log('alertContext:                 ' + alertContext);         
    console.log('alertCondition:               ' + alertCondition);           
    console.log('alertAllOf:                   ' + alertAllOf); 
    console.log('alertMetric:                  ' + alertMetric);
    console.log(' ');      
    console.log('resourceGroupName:            ' + resourceGroupName);              
    console.log('resourceName:                 ' + resourceName);
    console.log('alertLevel:                   ' + alertLevel);         
    console.log('alertSeverity:                ' + alertSeverity);          
    console.log(' ');               
    console.log('metricName:                   ' + metricName);       
    console.log('metricOperator:               ' + metricOperator);           
    console.log('metricThreshold:              ' + metricThreshold);            
    console.log('metricValue:                  ' + metricValue);
    console.log('status:                       ' + status); 
    console.log(' '); 
    console.log('alertStatus:                  ' + alertStatus);   
    console.log('itemName:                     ' + itemName);     
    console.log('hash:                         ' + hash); 
    console.log('host:                         ' + host); 
    console.log('itemKey:                      ' + itemKey);
    console.log(' ');            
    console.log('priority:                     ' + priority);     
    console.log('alertMessage:                 ' + alertMessage);         
    console.log('triggerExpression:            ' + triggerExpression);  
    console.log('****************************************************************');
    console.log(' ');

}

module.exports = {
    handleAlert
}