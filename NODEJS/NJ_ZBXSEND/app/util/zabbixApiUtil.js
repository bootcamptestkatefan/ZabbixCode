'use strict'
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
    console.log('1');
    getHostGroupByName(authToken,hostGroupName,function(result){
        if(result[0]==null){
            createHostGroup(authToken,hostGroupName,function(result){
                console.log("Group ID can't get, so create new host group");
                return callback(result.groupids[0]);
            });
        }else{
            console.log('Group ID get!');
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
    console.log('2');
    getHostByName(authToken,host,function(result){
        if(result[0]==null){
            createHost(authToken,host,hostGroupId,function(result){
                console.log("Host ID can't get, so create new host");
                return callback(result.hostids[0]);
            });
        }else{
            console.log("Host ID get!");
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
    console.log('3');
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
function checkTrigger(authToken,triggerDescription,triggerExpression,priority,callback){
    console.log('4');
    createTrigger(authToken,triggerDescription,triggerExpression,priority,function(result){
        console.log('4.1');
        if(result==null) // means new trigger cannot be made
            {
                console.log('No permission for making Trigger, return true');
                return callback(true);
            }
        else// means new trigger can be made
        {
            console.log('Trigger can be made, return false');
            return callback(false);
        }
    });
}

/*
    Detail      :   1) Create trigger on Zabbix by calling Zabbix API through generic function callZabbixAPI
                    2) After API call is completed, return the value returned by the callback function
*/
function createTrigger(authToken,triggerDescription,triggerExpression,priority,callback){
    console.log('5');
    var params = {
        "description":triggerDescription,
        "expression": triggerExpression,
        "priority": priority
    }
    console.log('5.1');
    callZabbixAPI(authToken,"trigger.create",params,function(result){
        // console.log(result);
        console.log('Creating Trigger');
        return callback(result);
    });
}

/*
    Detail      :   1) Create item on Zabbix by calling Zabbix API through generic function callZabbixAPI
                    2) After API call is completed, return the value returned by the callback function
*/
function createItem(authToken,hostId,itemName,itemKey,callback){
    console.log('0');
    var params = {
        "name":itemName,
        "key_":itemKey,
        "hostid":hostId,
        "type":2,
        "value_type":4
    }
    callZabbixAPI(authToken,"item.create",params,function(result){
        console.log(result);
        return callback(result);
    });
}

/*
    Detail      :   1) Send Zabbix item through node module node-zabbix-sender
                    2) After send is completed, call the callback function with result
*/
function sendZabbixItem(zabbixHost,zabbixItemKey,message,callback){
    console.log('6');
    var dest = zabberServer;
    var Sender = new ZabbixSender({host: dest}); 
    Sender.addItem(zabbixHost,zabbixItemKey,message);
    Sender.send(function(err,res){
        if(err){
            console.log('6.1');
            throw err;
        }else{
        console.log(res);
        callback(res);
        }
    })
}

/*
    Detail      :   1) Get host group (by name) from Zabbix by calling Zabbix API through generic function callZabbixAPI
                    2) After API call is completed, return the value returned by the callback function
*/
function getHostGroupByName(authToken,name,callback){
    console.log('7');
    var params = {
        "filter": {
            "name": name
        },
        "output": [
            "groupid"
        ]
    };
    callZabbixAPI(authToken,"hostgroup.get",params,function(result){
        console.log('Can get host group by name with result '+result);
        return callback(result);
    });
}

/*
    Detail      :   1) Create host group on Zabbix by calling Zabbix API through generic function callZabbixAPI
                    2) After API call is completed, return the value returned by the callback function
*/
function createHostGroup(authToken,name,callback){
    console.log('8');
    var params = {
        "name": name
    };
    callZabbixAPI(authToken,"hostgroup.create",params,function(result){
        console.log('8.1');
        return callback(result);
    });
}

/*
    Detail      :   1) Create host on Zabbix by calling Zabbix API through generic function callZabbixAPI
                    2) After API call is completed, return the value returned by the callback function
*/
function createHost(authToken,hostName,hostGroupId,callback){
    console.log('9');
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
        console.log('9.1');
        return callback(result);
    });
}

/*
    Detail      :   1) Get host (by name) from Zabbix by calling Zabbix API through generic function callZabbixAPI
                    2) After API call is completed, return the value returned by the callback function
*/
function getHostByName(authToken,host,callback){
    console.log('10');
    var params = {
        "filter": {
            "host": host
        },
        "output": [
            "hostid"
        ]
    };
    callZabbixAPI(authToken,"host.get",params,function(result){
        console.log('Can get host by name with hostId '+result);
        return callback(result);
    });
}

/*
    Detail      :   1) Login to Zabbix by calling Zabbix API through generic function callZabbixAPI
                    2) After API call is completed, return the value returned by the callback function
*/
function userLogin(account,password,callback){
    console.log('11');
    const params = {
        "user": account,
        "password": password
    };
    callZabbixAPI(null,"user.login",params,function(result){
        console.log('Can login');
        return callback(result);
    });
}

/*
    Detail      :   1) Logout from Zabbix by calling Zabbix API through generic function callZabbixAPI
*/
function userLogout(authToken){
    console.log('12');
    callZabbixAPI(authToken,"user.logout",[],function(result){
        if(!result){
            console.log("Logout Error");
        }
        console.log("Can logout!");
    });
}

/*
    Detail      :   Generic function for calling Zabbix API by POST
                    1) Fire POST request to Zabbix API by input parameters (params)
                    2) 2) If calling Zabbix API is successful, call callback function (with result) which is passed into this function
*/
function callZabbixAPI(authToken,method,params,callback){
    console.log('13');
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
                console.log('called API');
                return callback(body.result);
            }
            console.log("can't call API");
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
    sendZabbixItem,
    getHostGroupByName,
    createHostGroup,
    createHost,
    getHostByName,
    userLogin,
    userLogout,
    callZabbixAPI
}