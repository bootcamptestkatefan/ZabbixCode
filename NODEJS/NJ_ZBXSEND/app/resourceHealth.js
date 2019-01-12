var util = require('./util/zabbixApiUtil');
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
    console.log('kate ');
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
    var alertActionStatus = alertActivityLog.status||alertActivityLog.Status;

    console.log('alertData: ' + alertData);
    console.log('alertStatus: ' + alertStatus);
    console.log('alertContext: ' + alertContext);
    console.log('alertActivityLog: ' + alertActivityLog);
    console.log('alertEventTimeStamp: ' + alertEventTimeStamp);
    console.log('alertLevel: ' + alertLevel);
    console.log('alertProperties: ' + alertProperties);
    console.log('alertCurrentHealthStatus: ' + alertCurrentHealthStatus);
    console.log('alertPreviousHealthStatus: ' + alertPreviousHealthStatus);
    console.log('alertResourceId: ' + alertResourceId);
    console.log('alertResourceGroupName: ' + alertResourceGroupName);
    console.log('alertActionStatus: ' + alertActionStatus);

    // var hash = crypto.createHash('md5').update(alertId).digest('hex'); //for authentication https://www.dotnetcurry.com/nodejs/1237/digest-authentication-nodejs-application
    
    // var host = resourceGroupName+' - '+resourceName;
    // var itemKey = "custom.key."+hash;

    // var alertMessage = '['+alertStatus+']['+resourceGroupName+']['
    //              + alertName+'][S'+alertSeverity+']['+resourceName+' '+metricName+' '
    //              + metricOperator+' '+metricThreshold+', current value: '
    //              + metricValue+'][Time: '+alertTimeStamp+']';                           //yung lai joe d meh 
   
    // var triggerExpression = "{"+host+":"+itemKey+".regexp(\\\[S"+alertSeverity+"\\\])}>0 and {"
    //                         +host+":"+itemKey+".regexp(\\\[Deactivated\\\])}=0";
    // const priority = 5-alertSeverity;


    // checkZabbixItemMetric("Azure Resources",host,alertName,itemKey,triggerExpression,priority,function(result){
    //     if(!result){ //new trigger can be made            
    //         res.sendStatus(200);
    //         //Delay 45 seconds if it is a new alert
    //         timer(45000).then(_=>
    //             util.sendZabbixItem(host,itemKey,alertMessage,function respose(result){
    //         })
    //         );
    //     }else{ //new trigger cannot be made
    //         util.sendZabbixItem(host,itemKey,alertMessage,function respose(result){
    //             res.json(result);
    //         });                                
    //     }
    // });
}

module.exports = {
	handleAlert
}