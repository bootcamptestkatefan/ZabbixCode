/*--------------------------------------------------------------/
This js is for testing Zabbix API call,
a simple functional GUI is hosted on http://localhost:3000/admin
Offical Zabbix API document for zabbix server 3.4:
https://www.zabbix.com/documentation/3.4/manual/api/reference
/--------------------------------------------------------------*/
var request = require('request');
var express = require('express');
var session = require('express-session')

var app = express();

app.use(express.json({
    limit: '5mb'
}));
app.set('view engine', 'ejs');
app.use(session({
	saveUninitialized: true,
	resave: true,
    secret: 'Njp2TAc4gT'
}));

const zabbixServerAPIUrl = 'http://192.168.13.134/zabbix/api_jsonrpc.php';

app.listen(3003);
console.log('app listening on port 3003');

app.get('/admin', function (req, res) {
    console.log('home . . .');

    var session = req.session || {};
    var authToken = session.authToken || '';

    var pageHtml =
    '<!DOCTYPE HTML>\
    <html>\
        <head>\
            <title>Zabbix API Test</title>\
            <link href="https://maxcdn.bootstrapcdn.com/bootstrap/4.1.1/css/bootstrap.min.css" rel="stylesheet" />\
            <link href="/public/css/style.css" rel="stylesheet" />\
        </head>\
        <body>\
        <div id="page-content-wrapper">\
            <div class="container-fluid">\
                <h2>Zabbix API Test</h2>\
                <h3>authToken: '+authToken+'</h3>\
                <br>\
		        <a href="/auth/login" class="btn btn-primary">Zabbix Login</a>\
                <a href="/auth/logout" class="btn btn-primary">Zabbix Logout</a>\
                <br>\
                <br>\
                <a href="/admin/hosts" class="btn btn-secondary">Get Hosts</a>\
            </div>\
        </div>\
        </body>\
    </html>';
    res.send(pageHtml);
});

app.get('/auth/login', function (req, res) {
    console.log('calling login api . . .');
    userLogin(function(authToken){
        req.session.authToken = authToken;
        res.redirect('/admin');
    });
});

app.get('/auth/logout', function (req, res) {
    console.log('calling logout api . . .');
    userLogout(req.session.authToken); 
    req.session.destroy();
    res.redirect('/admin');
});

app.get('/admin/hosts', function (req, res){
    console.log('calling get hosts . . .');
    getHosts(req.session.authToken,function(result){

    var resultJSON = JSON.stringify(result, undefined, 2)

    var pageHtml =
    '<!DOCTYPE HTML>\
    <html>\
        <head>\
            <title>Get Hosts</title>\
            <link href="https://maxcdn.bootstrapcdn.com/bootstrap/4.1.1/css/bootstrap.min.css" rel="stylesheet" />\
        </head>\
        <body>\
            <pre>'+resultJSON+'</pre>\
            <ul>\
                <li><a href="/admin" class="btn btn-primary">back to admin home</a></li>\
            </ul>\
        </body>\
    </html>';
        res.send(pageHtml);
    });
});

function userLogin(callback){
    console.log("In login function . . .");
    const loginJson = {
        "jsonrpc": "2.0",
        "method": "user.login",
        "params": {
            "user": "Admin",
            "password": "zabbix"
        },
        "id": 1,
        "auth": null
    };
    request.post(
        zabbixServerAPIUrl,
        { json: loginJson},
        function (error, response, body) {
            if (!error && response.statusCode == 200) {
                console.log(body);
                var authToken=body.result;
                return callback(authToken);
            }
        }
    );
}

function getHosts(authToken,callback){
    var apiRequestJson = {
        "jsonrpc": "2.0",
        "method": "host.get",
        "params": {
            "output": [
                "hostid",
                "host",
                "name"
            ]
        },
        "id": 2,
        "auth": authToken
    }
    request.post(
        zabbixServerAPIUrl,
        { json: apiRequestJson},
        function (error, response, body) {
            if (!error && response.statusCode == 200) {
                console.log(body);
                return callback(body.result);
            }
        }
    );
}
function getItems(authToken,hostId,customKey,callback){
    console.log('getting items of hostId {'+hostId+'}');
    var apiRequestJson={
        "jsonrpc": "2.0",
        "method": "item.get",
        "params": {
            "output": "extend",
            "hostids": hostId,
            "search": {
                "key_": customKey
            },
            //"sortfield": "name" //optional
        },
        "auth": authToken,
        "id": 1
    }
    request.post(
        zabbixServerAPIUrl,
        { json: apiRequestJson},
        function (error, response, body) {
            if (!error && response.statusCode == 200) {
                console.log(body);
                return callback(body.result);
            }
        }
    );
}
// function createTrigger(triggerDescription,triggerExpression,authToken){
//     console.log('creating trigger . . .');
//     var apiRequestJson={
//         "jsonrpc": "2.0",
//         "method": "trigger.create",
//         "params": {
//             "description": triggerDescription,
//             "expression": triggerExpression,
//             "dependencies": [
//                 {
//                     "triggerid": "14062"
//                 }
//             ]
//         },
//         "auth": authToken,
//         "id": 1
//     };request.post(
//         zabbixServerAPIUrl,
//         { json: apiRequestJson},
//         function (error, response, body) {
//             if (!error && response.statusCode == 200) {
//                 console.log(body);
//                 return callback(body);//sample: { jsonrpc: '2.0', result: { triggerids: [ '14102' ] }, id: 1 }
//             }
//         }
//     );

// }
function createItem(authToken,hostId,customKey,callback){
    console.log('creating item . . .');
    var apiRequestJson={
        "jsonrpc": "2.0",
        "method": "item.create",
        "params": {
            "name": "Alert custom.key."+customKey,
            "key_": "custom.key."+customKey,
            "hostid": hostId,
            "type": 2, //tyupe id=2 for trapper
            "value_type": 4, //value type=4 for text type
            //"interfaceid": "30084",//host's interface, optional for zabbix trapper
            "applications": [
            ],
            //"delay": "30s"//update interval for item, optional for zabbix trapper
        },
        "auth": authToken,
        "id": 1
    };
    request.post(
        zabbixServerAPIUrl,
        { json: apiRequestJson},
        function (error, response, body) {
            if (!error && response.statusCode == 200) {
                console.log(body);
                return callback(body);//sample: { jsonrpc: '2.0', result: { itemids: [ '29110' ] }, id: 1 }
            }
        }
    );
}
function userLogout(authToken){
    console.log("In logout function . . .");
    var apiRequestJson={
        "jsonrpc": "2.0",
        "method": "user.logout",
        "params": [],
        "id": 1,
        "auth": authToken
    };
    request.post(
        zabbixServerAPIUrl,
        { json: apiRequestJson},
        function (error, response, body) {
            if (!error && response.statusCode == 200) {
                console.log(body);
            }
        }
    );
}