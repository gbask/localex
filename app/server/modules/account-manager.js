
var crypto 		= require('crypto');
var MongoDB 	= require('mongodb').Db;
var Server 		= require('mongodb').Server;
var moment 		= require('moment');

var dbPort 		= 10033;
var dbHost 		= 'paulo.mongohq.com';
var dbName 		= 'local_ex_sample_1';
var dbUserName	= process.env.DB_USER_NAME;
var dbPassword	= process.env.DB_PASSWORD;

/* establish the database connection */

var db = new MongoDB(dbName, new Server(dbHost, dbPort, {auto_reconnect: true}), {w: 1});

	db.open( function(err) {
		db.authenticate(
			dbUserName,
			dbPassword,
			function(err){
				if (err) {
				console.log(err);
				}	else{
					console.log('connected to database :: ' + dbName);
				}
			}
		);
	});
var accounts = db.collection('accounts');


/* login validation methods */

exports.autoLogin = function(user, pass, callback)
{
	accounts.findOne({user:user}, function(e, o) {
		if (o){
			o.pass == pass ? callback(o) : callback(null);
		}	else{
			callback(null);
		}
	});
}

exports.manualLogin = function(user, pass, callback)
{
	accounts.findOne({user:user}, function(e, o) {
		if (o == null){
			callback('user-not-found');
		}	else{
			validatePassword(pass, o.pass, function(err, res) {
				if (res){
					callback(null, o);
				}	else{
					callback('invalid-password');
				}
			});
		}
	});
}

/* record insertion, update & deletion methods */

exports.addNewAccount = function(newData, callback)
{
	accounts.findOne({user:newData.user}, function(e, o) {
		if (o){
			callback('username-taken');
		}	else{
			accounts.findOne({email:newData.email}, function(e, o) {
				if (o){
					callback('email-taken');
				}	else{
					saltAndHash(newData.pass, function(hash){
						newData.pass = hash;
					// append date stamp when record was created //
						newData.date = moment().format('MMMM Do YYYY, h:mm:ss a');
						accounts.insert(newData, {safe: true}, callback);
					});
				}
			});
		}
	});
}

exports.updateAccount = function(newData, callback)
{
	accounts.findOne({user:newData.user}, function(e, o){
		o.name 		= newData.name;
		o.email 	= newData.email;
		o.city		= newData.city;
		o.state		= newData.state;
		o.country 	= newData.country;
		o.image		= newData.image;
		o.description = newData.description;
		o.tag_line 	= newData.tag_line;
		if (newData.pass == ''){
			accounts.save(o, {safe: true}, function(err) {
				if (err) callback(err);
				else callback(null, o);
			});
		}	else{
			saltAndHash(newData.pass, function(hash){
				o.pass = hash;
				accounts.save(o, {safe: true}, function(err) {
					if (err) callback(err);
					else callback(null, o);
				});
			});
		}
	});
}

exports.updatePassword = function(email, newPass, callback)
{
	accounts.findOne({email:email}, function(e, o){
		if (e){
			callback(e, null);
		}	else{
			saltAndHash(newPass, function(hash){
		        o.pass = hash;
		        accounts.save(o, {safe: true}, callback);
			});
		}
	});
}

exports.addCommentToArticle = function(userId, comment, callback) {
	console.log("AM: " + comment.person + comment.comment)
	accounts.update(
		{_id: getObjectId(userId)},
		{"$push": {comments: comment}},
		function(error, article){
			if(error){
				console.log(error);
				callback(error);
			}
			else callback(null, article)
		});
		
}


/* account lookup methods */

exports.deleteAccount = function(id, callback)
{
	accounts.remove({_id: getObjectId(id)}, callback);
}

exports.getAccountByEmail = function(email, callback)
{
	accounts.findOne({email:email}, function(e, o){ callback(o); });
}

exports.validateResetLink = function(email, passHash, callback)
{
	accounts.find({ $and: [{email:email, pass:passHash}] }, function(e, o){
		callback(o ? 'ok' : null);
	});
}

exports.getAllRecords = function(callback)
{
	accounts.find().toArray(
		function(e, res) {
		if (e) callback(e)
		else callback(null, res)
	});
};

exports.delAllRecords = function(callback)
{
	accounts.remove({}, callback); // reset accounts collection for testing //
}

/* private encryption & validation methods */

var generateSalt = function()
{
	var set = '0123456789abcdefghijklmnopqurstuvwxyzABCDEFGHIJKLMNOPQURSTUVWXYZ';
	var salt = '';
	for (var i = 0; i < 10; i++) {
		var p = Math.floor(Math.random() * set.length);
		salt += set[p];
	}
	return salt;
}

var md5 = function(str) {
	return crypto.createHash('md5').update(str).digest('hex');
}

var saltAndHash = function(pass, callback)
{
	var salt = generateSalt();
	callback(salt + md5(pass + salt));
}

var validatePassword = function(plainPass, hashedPass, callback)
{
	var salt = hashedPass.substr(0, 10);
	var validHash = salt + md5(plainPass + salt);
	callback(null, hashedPass === validHash);
}

/* auxiliary methods */

var getObjectId = function(id)
{
	return accounts.db.bson_serializer.ObjectID.createFromHexString(id)
}

exports.findById = function(id, callback)
{
	accounts.findOne({_id: getObjectId(id)},
		function(e, res) {
		if (e) callback(e)
		else callback(null, res)
	});
};


exports.findByMultipleFields = function(a, callback)
{
// this takes an array of name/val pairs to search against {fieldName : 'value'} //
	accounts.find( { $or : a } ).toArray(
	//accounts.find( {state:'california'}).toArray(
		function(e, results) {
		if (e) callback(e)
		else callback(null, results)
	});
}

exports.populateLocationCountTables = function(a, callback)
{
	var country_array = [];
	var state_array = [];
	var city_array = [];
	var c_counter = 0;
	var c_index = 0;
	var s_counter = 0;
	var s_index = 0;
	var ci_counter = 0;
	var ci_index = 0;
	
	if(a != null) {
	//this.getAllRecords( function(e, accounts) {
		
		for(var i = 0; i < a.length; i++) {
			var cnty = a[i].country;
			for(var j = 0; j < country_array.length; j++) {
				if(country_array[j].country == a[i].country) {
					c_counter += 1;
					c_index = j;
					//break;
				}
			}
			if(c_counter == 0) {
				new_array = {country: a[i].country, country_len: 1};
				country_array.push(new_array);
			}
			else {
				country_array[c_index].country_len += 1;
				c_counter = 0;
			}
			
			for(var k = 0; k < state_array.length; k++) {
				if(state_array[k].state == a[i].state) {
					s_counter += 1;
					s_index = k;
				}
			}
			if(s_counter == 0) {
				new_array = {state: a[i].state, state_len: 1};
				state_array.push(new_array);
			}
			else {
				state_array[s_index].state_len += 1;
				s_counter = 0;
			}
			
			for(var l = 0; l < city_array.length; l++) {
				if(city_array[l].city == a[i].city) {
					ci_counter += 1;
					ci_index = l;
				}
			}
			if(ci_counter == 0) {
				new_array = {city: a[i].city, city_len: 1};
				city_array.push(new_array);
			}
			else {
				city_array[ci_index].city_len += 1;
				ci_counter = 0;
			}
				
		}
		callback(null, country_array, state_array, city_array);
	}
	//});
}