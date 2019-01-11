var request = require('request');
var express = require('express');
//var app = express();
var app = express().use(express.json());
//var router = express.Router();

var crypto = require('crypto');
var ZabbixSender = require('node-zabbix-sender');

//var config = require('./config/zbxsend-config.json');
var config = require('./devconfig/zbxsend-config.json');

const zabberServer = config.zabbixServerUrl;
//const zabberServer = config.zabbixServerUrl;
const zabbixServerAPIUrl ='http://'+zabberServer+'/zabbix/api_jsonrpc.php';

 const zabbixAccount = config.zabbixAccount;
//const zabbixAccount = devconfig.zabbixAccount;
 const zabbixPassword = config.zabbixPassword
//const zabbixPassword = devconfig.zabbixPassword

/* 
    config is getting from "./devconfig/zbxsend-config.json" 
    webHookPort is defined inside this config file
*/
app.listen(config.webHookPort,() => console.log('Webhook is listening on port '+config.webHookPort));

//fantszching

//fantszching

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

app.post('/azureMetricAlert',(req,res) => {
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
            res.sendStatus(200);
            //Delay 45 seconds if it is a new alert
            timer(45000).then(_=>
                sendZabbixItem(host,itemKey,alertMessage,function respose(result){
            })
            );
        }else{ //new trigger cannot be made
            sendZabbixItem(host,itemKey,alertMessage,function respose(result){
                res.json(result);
            });                                
        }
    });
     
});

const timer = ms => new Promise( res => setTimeout(res, ms));


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
    userLogin(zabbixAccount,zabbixPassword,function(authToken){
        checkHostGroup(authToken,hostGroupName,function(hostGroupId){
            checkHost(authToken,host,hostGroupId,function(hostId){
                checkItem(authToken,hostId,itemName,itemKey,function(itemId){
                    checkTrigger(authToken,itemName,triggerExpression,triggerPriority,function(result){
                        userLogout(authToken);
                        return callback(result);
                    });
                });
            })
        });
    });
}


/*
    Detail      :   1) Get host group (by name) from Zabbix through by calling Zabbix API through generic function callZabbixAPI
                    2) After API call is completed, check if the host group exists
                        2.1) If the host group not exists
                            2.1.1) Create host group on Zabbix by calling function createHostGroup. 
                            2.1.2) Call the callback function with the ID of the created host group
                            2.1.3) Return the value return by the callback function
                        2.2) If the host exists
                            2.2.1) Call the callback function with the host group ID
                            2.2.2) Return the value return by the callback function
*/
function checkHostGroup(authToken,hostGroupName,callback){
    getHostGroupByName(authToken,hostGroupName,function(result){
        if(result[0]==null){
            createHostGroup(authToken,hostGroupName,function(result){
                return callback(result.groupids[0]);
            });
        }else{
            return callback(result[0].groupid);
        }
    });
}

/*
    Detail      :   1) Get host (by name) from Zabbix through by calling Zabbix API through generic function callZabbixAPI
                    2) After API call is completed, check if the host exists
                        2.1) If the host not exists
                            2.1.1) Create host on Zabbix by calling function createHost. 
                            2.1.2) Call the callback function with the ID of the created host
                            2.1.3) Return the value return by the callback function
                        2.2) If the host exists
                            2.2.1) Call the callback function with the host ID
                            2.2.2) Return the value return by the callback function
*/
function checkHost(authToken,host,hostGroupId,callback){
    getHostByName(authToken,host,function(result){
        if(result[0]==null){
            createHost(authToken,host,hostGroupId,function(result){
                return callback(result.hostids[0]);
            });
        }else{
            return callback(result[0].hostid)
        }
    });
}

/*
    Detail      :   1) Get item from Zabbix through by calling Zabbix API through generic function callZabbixAPI
                    2) After API call is completed, check if the item exists
                        2.1) If the item not exists
                            2.1.1) Create item on Zabbix by calling function createItem. 
                            2.1.2) Call the callback function with the ID of the created item
                            2.1.3) Return the value return by the callback function
                        2.2) If the item exists
                            2.2.1) Call the callback function with the item ID
                            2.2.2) Return the value return by the callback function
*/
function checkItem(authToken,hostId,itemName,itemKey,callback){
    var params = {
        "output":["key_"],
        "filter":{
            "key_":itemKey
        }
    };
    callZabbixAPI(authToken,"item.get",params,function(result){
        if(result[0]==null){
            createItem(authToken,hostId,itemName,itemKey,function(result){
                return callback(result.itemids[0]);
            });
        }else{
            return callback(result[0].itemid);
        }
    });
}

/*
    Detail      :   1) Check trigger exists by trying to create trigger on Zabbix?
                    2) After API call is completed, return true/false returned by the callback function
*/
function checkTrigger(authToken,triggerDescription,triggerExpression,priority,callback){
    createTrigger(authToken,triggerDescription,triggerExpression,priority,function(result){
        if(result==null) // means new trigger cannot be made
            return callback(true);
        else// means new trigger can be made
            return callback(false);
    });
}

/*
    Detail      :   1) Create trigger on Zabbix by calling Zabbix API through generic function callZabbixAPI
                    2) After API call is completed, return the value returned by the callback function
*/
function createTrigger(authToken,triggerDescription,triggerExpression,priority,callback){
    var params = {
        "description":triggerDescription,
        "expression": triggerExpression,
        "priority": priority
    }
    callZabbixAPI(authToken,"trigger.create",params,function(result){
        return callback(result);
    });
}

/*
    Detail      :   1) Create item on Zabbix by calling Zabbix API through generic function callZabbixAPI
                    2) After API call is completed, return the value returned by the callback function
*/
function createItem(authToken,hostId,itemName,itemKey,callback){
    var params = {
        "name":itemName,
        "key_":itemKey,
        "hostid":hostId,
        "type":2,
        "value_type":4
    }
    callZabbixAPI(authToken,"item.create",params,function(result){
        return callback(result);
    });
}

/*
    Detail      :   1) Send Zabbix item through node module node-zabbix-sender
                    2) After send is completed, call the callback function with result
*/
function sendZabbixItem(zabbixHost,zabbixItemKey,message,callback){
    var dest = zabberServer;
    var Sender = new ZabbixSender({host: dest}); 
    Sender.addItem(zabbixHost,zabbixItemKey,message);
    Sender.send(function(err,res){
        if(err){
            throw err;
        }
        //console.log(res);
        callback(res);
    })
}

/*
    Detail      :   1) Get host group (by name) from Zabbix by calling Zabbix API through generic function callZabbixAPI
                    2) After API call is completed, return the value returned by the callback function
*/
function getHostGroupByName(authToken,name,callback){
    var params = {
        "filter": {
            "name": name
        },
        "output": [
            "groupid"
        ]
    };
    callZabbixAPI(authToken,"hostgroup.get",params,function(result){
        return callback(result);
    });
}

/*
    Detail      :   1) Create host group on Zabbix by calling Zabbix API through generic function callZabbixAPI
                    2) After API call is completed, return the value returned by the callback function
*/
function createHostGroup(authToken,name,callback){
    var params = {
        "name": name
    };
    callZabbixAPI(authToken,"hostgroup.create",params,function(result){
        return callback(result);
    });
}

/*
    Detail      :   1) Create host on Zabbix by calling Zabbix API through generic function callZabbixAPI
                    2) After API call is completed, return the value returned by the callback function
*/
function createHost(authToken,hostName,hostGroupId,callback){
    var params = {
        "host": hostName,
        "interfaces":[
            {
                "type":1,
                "main":1,
                "useip":1,
                "ip":"127.0.0.1",
                "dns":"",
                "port":"10050"
            }
        ],
        "groups":[{"groupid":hostGroupId}]
    }
    callZabbixAPI(authToken,"host.create",params,function(result){
        return callback(result);
    });
}

/*
    Detail      :   1) Get host (by name) from Zabbix by calling Zabbix API through generic function callZabbixAPI
                    2) After API call is completed, return the value returned by the callback function
*/
function getHostByName(authToken,host,callback){
    var params = {
        "filter": {
            "host": host
        },
        "output": [
            "hostid"
        ]
    };
    callZabbixAPI(authToken,"host.get",params,function(result){
        return callback(result);
    });
}

/*
    Detail      :   1) Login to Zabbix by calling Zabbix API through generic function callZabbixAPI
                    2) After API call is completed, return the value returned by the callback function
*/
function userLogin(account,password,callback){
    const params = {
        "user": account,
        "password": password
    };
    callZabbixAPI(null,"user.login",params,function(result){
        return callback(result);
    });
}

/*
    Detail      :   1) Logout from Zabbix by calling Zabbix API through generic function callZabbixAPI
*/
function userLogout(authToken){
    callZabbixAPI(authToken,"user.logout",[],function(result){
        if(!result){
            console.log("Logout Error");
        }
    });
}

/*
    Detail      :   Generic function for calling Zabbix API by POST
                    1) Fire POST request to Zabbix API by input parameters (params)
                    2) 2) If calling Zabbix API is successful, call callback function (with result) which is passed into this function
*/
function callZabbixAPI(authToken,method,params,callback){
    var apiRequestJson={
        "jsonrpc": "2.0",
        "method": method,
        "params": params,
        "id": 1,
        "auth": authToken
    }
    request.post(
        zabbixServerAPIUrl,
        { json: apiRequestJson},
        function (error, response, body) {
            if (!error && response.statusCode == 200) {
                return callback(body.result);
            }
        }
    );
}

//fantszching
//module.exports = router;