var request = require('request');
var express = require('express');
var app = express();
//var app = express().use(express.json());

var crypto = require('crypto');
var ZabbixSender = require('node-zabbix-sender');

var config = require('./devconfig/zbxsend-config.json');
const zabberServer = config.zabbixServerUrl;
const zabbixServerAPIUrl ='http://'+zabberServer+'/zabbix/api_jsonrpc.php';
const zabbixAccount = config.zabbixAccount;
const zabbixPassword = config.zabbixPassword

app.listen(config.webHookPort,() => console.log('Webhook is listening on port '+config.webHookPort));

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
    var alertMetric = alertCondition[0];

    var metricName = alertMetric.metricName||alertMetric.MetricName;
    var metricOperator = alertMetric.operator||alertMetric.Operator;
    var metricThreshold = alertMetric.threshold||alertMetric.Threshold;
    var metricValue = alertMetric.metricValue||alertMetric.MetricValue;

    var hash = crypto.createHash('md5').update(alertId).digest('hex');
    
    var host = resourceGroupName+' - '+resourceName;
    var itemKey = "custom.key."+hash;

    var alertMessage = '['+alertStatus+']['+resourceGroupName+']['
                 + alertName+'][S'+alertSeverity+']['+resourceName+' '+metricName+' '
                 + metricOperator+' '+metricThreshold+', current value: '
                 + metricValue+'][Time: '+alertTimeStamp+']';
   
    var triggerExpression = "{"+host+":"+itemKey+".regexp(\\\[S"+alertSeverity+"\\\])}>0 and {"
                            +host+":"+itemKey+".regexp(\\\[Deactivated\\\])}=0";
    const priority = 5-alertSeverity;

    checkZabbixItem("Azure Resources",host,alertName,itemKey,triggerExpression,priority,function(result){
        if(!result){            
            res.sendStatus(200);
            //Delay 45 seconds if it is a new alert
            timer(45000).then(_=>
                sendZabbixItem(host,itemKey,alertMessage,function respose(result){
                })
            );
        }else{
            sendZabbixItem(host,itemKey,alertMessage,function respose(result){
                res.json(result);
            });
        }
    });
});

const timer = ms => new Promise( res => setTimeout(res, ms));

function checkZabbixItem(hostGroupName,host,itemName,itemKey,triggerExpression,triggerPriority,callback){
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
function checkTrigger(authToken,triggerDescription,triggerExpression,priority,callback){
    createTrigger(authToken,triggerDescription,triggerExpression,priority,function(result){
        if(result==null)
            return callback(true);
        else
            return callback(false);
    });
}
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
function sendZabbixItem(zabbixHost,zabbixItemKey,message,callback){
    var dest = zabberServer;
    var Sender = new ZabbixSender({host: dest}); 
    Sender.addItem(zabbixHost,zabbixItemKey,message);
    Sender.send(function(err,res){
        if(err){
            throw err;
        }
        callback(res);
    })
}
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
function createHostGroup(authToken,name,callback){
    var params = {
        "name": name
    };
    callZabbixAPI(authToken,"hostgroup.create",params,function(result){
        return callback(result);
    });
}
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
function userLogin(account,password,callback){
    const params = {
        "user": account,
        "password": password
    };
    callZabbixAPI(null,"user.login",params,function(result){
        return callback(result);
    });
}
function userLogout(authToken){
    callZabbixAPI(authToken,"user.logout",[],function(result){
        if(!result){
            console.log("Logout Error");
        }
    });
}
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