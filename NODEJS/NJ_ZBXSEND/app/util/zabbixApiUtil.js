var request = require('request');
var ZabbixSender = require('node-zabbix-sender');
var config = require('../devconfig/zbxsend-config.json');

const zabberServer = config.zabbixServerUrl;
const zabbixServerAPIUrl ='http://'+zabberServer+'/zabbix/api_jsonrpc.php';


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
    console.log('Checking Host Group...');
    getHostGroupByName(authToken,hostGroupName,function(result){
        if(result[0]==null){
            createHostGroup(authToken,hostGroupName,function(result){
                console.log("Group ID can't get, so create new host group");
                return callback(result.groupids[0]);
            });
        }else{
            console.log("Host group get, with groupID "+result[0].groupid);
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
    console.log('Checking Host...');
    getHostByName(authToken,host,function(result){
        if(result[0]==null){
            createHost(authToken,host,hostGroupId,function(result){
                console.log("Host ID can't get, so create new host");
                return callback(result.hostids[0]);
            });
        }else{
            console.log("Host get, with hostID "+result[0].hostid);
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
    console.log('Checking Item...');
    var params = {
        "output":["key_"],
        "filter":{
            "key_":itemKey
        }
    };
    callZabbixAPI(authToken,"item.get",params,function(result){
        if(result[0]==null){
            createItem(authToken,hostId,itemName,itemKey,function(result){
                console.log("Item ID can't get, so create new Item");
                return callback(result.itemids[0]);
            });
        }else{
            console.log("Item get, with itemId "+result[0].itemid);
            return callback(result[0].itemid);
        }
    });
}

/*
    Detail      :   1) Check trigger exists by trying to create trigger on Zabbix?
                    2) After API call is completed, return true/false returned by the callback function
*/
/*
function checkTrigger(host,itemKey,authToken,triggerExpression,priority,callback){
    // console.log('Checking Trigger...');
    createOneTrigger(host,itemKey,authToken,triggerExpression,priority,function(result){
        if(result==null) // means new trigger cannot be made
            {
                // console.log('No need to create new trigger, return true');
                return callback(true);
            }
        else// means new trigger can be made
        {
            for (var severity=1;severity<=5;severity++){
            var newSeverity = 5 - severity;
            var FiveExpression="{"+host+":"+itemKey+".regexp(\\\[S"+newSeverity+"\\\])}>0 and {"+host+":"+itemKey+".regexp(\\\[Resolved\\\])}=0"
            createFiveTrigger(authToken,FiveExpression,severity);
            }
            // console.log('Five New trigger is made, return false');
            return callback(false);
        }
    });
}
*/
function checkTrigger(host, itemKey, authToken, triggerExpression, priority, callback){
    // console.log('Checking Trigger...');
    

    createTrigger(authToken, triggerExpression, priority, function(result){
        if(result==null) // means new trigger cannot be made
        {
            // console.log('No need to create new trigger, return true');
            return callback(true);
        }
        else
        {
            for (var severity=1; severity<=5; severity++){
                var newSeverity = 6 - severity;
                var FiveExpression="{"+host+":"+itemKey+".regexp(\\\[S"+newSeverity+"\\\])}>0 and {"+host+":"+itemKey+".regexp(\\\[Resolved\\\])}=0"
                createTrigger(authToken, FiveExpression, severity, function(result) {
                    
                });
            }
            // console.log('Five New trigger is made, return false');
            return callback(false); 
        }
    });
}

function createTrigger(authToken, triggerExpression, priority, callback){
    // console.log('Checking whether there is need to create new Trigger...');
    console.log(triggerExpression);
    var params = {
        "description": '{{ITEM.VALUE}.regsub("(.*)", " \\1")}',
        "expression": triggerExpression,
        "priority": priority
    }
    callZabbixAPI(authToken,"trigger.create",params,function(result){
        // console.log('Checking in progress...');
        return callback(result);
    });
}
/*
function createFiveTrigger(authToken,FiveExpression,severity){
    // console.log('Checking whether there is need to create five Trigger...');
    console.log(FiveExpression);
    var params = {
        //"description": '{{ITEM.VALUE}.regsub("^\[.*", " \1 \2")}',
        "description": '{{ITEM.VALUE}.regsub("^([\[A-Za-z0-9\],:.]+) ([\[A-Za-z0-9\],:.]+) ([\[A-Za-z0-9\],:.]+) ([\[A-Za-z0-9\],:.]+) ([\[A-Za-z0-9\],:.]+) ([\[A-Za-z0-9\],:.]+) ([\[A-Za-z0-9\],:.]+) ([\[A-Za-z0-9\],:.]+)", " \2_\3")}',
        "expression": FiveExpression,
        "priority": severity //for color of the alert
    }
    callZabbixAPI(authToken,"trigger.create",params,function(){
        // console.log('Checking in progress...');
    });
}
*/
/*
    Detail      :   1) Create trigger on Zabbix by calling Zabbix API through generic function callZabbixAPI
                    2) After API call is completed, return the value returned by the callback function
*/
/*
function createOneTrigger(host,itemKey,authToken,triggerExpression,priority,callback){
    // console.log('Checking whether there is need to create new Trigger...');
    console.log(triggerExpression);
    var params = {
        "description": '{{ITEM.VALUE}.regexp("^([\[A-Za-z0-9\],:.]+) ([\[A-Za-z0-9\],:.]+) ([\[A-Za-z0-9\],:.]+) ([\[A-Za-z0-9\],:.]+) ([\[A-Za-z0-9\],:.]+) ([\[A-Za-z0-9\],:.]+) ([\[A-Za-z0-9\],:.]+) ([\[A-Za-z0-9\],:.]+)", " \2_\3")}',
        "expression": triggerExpression,
        "priority": priority
    }
    callZabbixAPI(authToken,"trigger.create",params,function(result){
        // console.log('Checking in progress...');
        return callback(result);
    });
}
*/
/*
    Detail      :   1) Create item on Zabbix by calling Zabbix API through generic function callZabbixAPI
                    2) After API call is completed, return the value returned by the callback function
*/
function createItem(authToken,hostId,itemName,itemKey,callback){
    console.log('Creating New item...');
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
    console.log('Sending Zabbix Item...');
    console.log('Below information are going to be sent.')
    console.log(' ');
    var dest = zabberServer;
    var Sender = new ZabbixSender({host: dest});
    console.log('zabbixHost:                '+zabbixHost);
    console.log('zabbixItemKey:             '+zabbixItemKey);
    console.log('message:                   '+message);
    console.log(' ');
    Sender.addItem(zabbixHost,zabbixItemKey,message);
    Sender.send(function(err,res){
        if(err){
            console.log('Error is found, please check!');
            throw err;
        }else{
            console.log('information has been sent to Zabbix, please check.')
            console.log(res);
            console.log(' ');
            callback(res);
        }
    })
}

/*
    Detail      :   1) Get host group (by name) from Zabbix by calling Zabbix API through generic function callZabbixAPI
                    2) After API call is completed, return the value returned by the callback function
*/
function getHostGroupByName(authToken,name,callback){
    console.log('Getting Host group by name');
    var params = {
        "filter": {
            "name": name
        },
        "output": [
            "groupid"
        ]
    };
    callZabbixAPI(authToken,"hostgroup.get",params,function(result){
        console.log('Host group can be got by name with result: '+result);
        return callback(result);
    });
}

/*
    Detail      :   1) Create host group on Zabbix by calling Zabbix API through generic function callZabbixAPI
                    2) After API call is completed, return the value returned by the callback function
*/
function createHostGroup(authToken,name,callback){
    console.log('Creating New host Group...');
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
    console.log('Creating Host...');
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
    console.log('Getting Host By name...');
    var params = {
        "filter": {
            "host": host
        },
        "output": [
            "hostid"
        ]
    };
    callZabbixAPI(authToken,"host.get",params,function(result){
        console.log('Host can be got by name with hostId '+result);
        return callback(result);
    });
}

/*
    Detail      :   1) Login to Zabbix by calling Zabbix API through generic function callZabbixAPI
                    2) After API call is completed, return the value returned by the callback function
*/
function userLogin(account,password,callback){
    console.log('Logining In...');
    const params = {
        "user": account,
        "password": password
    };
    callZabbixAPI(null,"user.login",params,function(result){
        return callback(result);
        console.log('Log-In successfully!');
    });
}

/*
    Detail      :   1) Logout from Zabbix by calling Zabbix API through generic function callZabbixAPI
*/
function userLogout(authToken){
    console.log('Logining Out...');
    callZabbixAPI(authToken,"user.logout",[],function(result){
        if(!result){
            console.log("Logout Error!");
        }
        console.log("Logout-out successfully!");
    });
}

/*
    Detail      :   Generic function for calling Zabbix API by POST
                    1) Fire POST request to Zabbix API by input parameters (params)
                    2) 2) If calling Zabbix API is successful, call callback function (with result) which is passed into this function
*/
function callZabbixAPI(authToken,method,params,callback){
    console.log('In progress...');
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
                console.log('API can be called');
                return callback(body.result);
            }
            console.log("Failed to call the API");
        }
    );
}


module.exports = {
    checkHostGroup,
    checkHost,
    createItem,
    checkItem,
    checkTrigger,
    createTrigger,
    //createOneTrigger,
    sendZabbixItem,
    getHostGroupByName,
    createHostGroup,
    createHost,
    getHostByName,
    userLogin,
    userLogout,
    callZabbixAPI
}