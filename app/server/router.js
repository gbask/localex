
var CT = require('./modules/country-list');
var AM = require('./modules/account-manager');
var EM = require('./modules/email-dispatcher');

var gm = require('gm').subClass({ imageMagick: true});
var fs = require('fs');
var url = require('url');
var homepage_buf = new Buffer(fs.readFileSync('app/server/views/index.html'));
var contact_buf = new Buffer(fs.readFileSync('app/server/views/contact.html'));

module.exports = function(app) {

// home page //
	app.get('/', function(req, res){
		res.send(homepage_buf.toString('utf-8'));
		var queryObject = url.parse(req.url,true).query;
		//console.log(queryObject);
		
		AM.populateLocationCountTables(function(e, accounts) {
			console.log('made it');
		});
		
		if(queryObject.state != '' && queryObject.city == '') {
			res.redirect('/list/' + queryObject.state);
		} else if (queryObject.state == '' && queryObject.city != '') {
			res.redirect('/list/city/' + queryObject.city);
		} else if (queryObject.state != null && queryObject.city != null) {
			res.redirect('/list/' + queryObject.state + '/' + queryObject.city);
		}
	});
	
	app.post('/', function(req, res) {
		var queryObject = url.parse(req.url,true).query;
		console.log(queryObject);
	});
	
// contact page //
	app.get('/contact', function(req, res){
		res.send(contact_buf.toString('utf-8'));
	});

// main login page //

	app.get('/login', function(req, res){
	// check if the user's credentials are saved in a cookie //
		if (req.cookies.user == undefined || req.cookies.pass == undefined){
			res.render('login', { title: 'Hello - Please Login To Your Account' });
		}	else{
	// attempt automatic login //
			AM.autoLogin(req.cookies.user, req.cookies.pass, function(o){
				if (o != null){
				    req.session.user = o;
					res.redirect('/home');
				}	else{
					res.render('login', { title: 'Hello - Please Login To Your Account' });
				}
			});
		}
	});
	
	app.post('/login', function(req, res){
		AM.manualLogin(req.param('user'), req.param('pass'), function(e, o){
			if (!o){
				res.send(e, 400);
			}	else{
			    req.session.user = o;
				if (req.param('remember-me') == 'true'){
					res.cookie('user', o.user, { maxAge: 900000 });
					res.cookie('pass', o.pass, { maxAge: 900000 });
				}
				res.send(o, 200);
			}
		});
	});
	
// logged-in user homepage //
	
	app.get('/home', function(req, res) {
	    if (req.session.user === null){
	// if user is not logged-in redirect back to login page //
	        res.redirect('/');
	    }   else{
			res.render('home', {
				title : 'Control Panel',
				countries : CT,
				udata : req.session.user
			});
	    }
	});
	
	app.post('/home', function(req, res){
		if (req.files.image != null) {
			var tmp_path = req.files.image.path;
			
			var target_path = './app/public/img/users/' + req.files.image.name;
			var picture_path = './img/users/' + req.files.image.name;
			fs.rename(tmp_path, target_path, function(err) {
				if(err) throw err;
				fs.unlink(tmp_path, function() {
					if(err) throw err;
				});
			});
		}
		//gm(tmp_path).resize(100, 100).write(target_path, function(err) {
			//if(err) throw err;
		//});
		if (req.param('user') != undefined) {
			console.log(req.param.comments);
			AM.updateAccount({
				user 		: req.param('user'),
				name 		: req.param('name'),
				email 		: req.param('email'),
				city		: ucFirstAllWords(req.param('city')),
				state		: ucFirstAllWords(req.param('state')),
				country 	: req.param('country'),
				pass		: req.param('pass'),
				image		: picture_path,
				tag_line	: req.param('tag_line'),
				description : req.param('description')
			}, function(e, o){
				if (e){
					res.send('error-updating-account', 400);
				}	else{
					req.session.user = o;
			// update the user's login cookies if they exists //
					if (req.cookies.user != undefined && req.cookies.pass != undefined){
						res.cookie('user', o.user, { maxAge: 900000 });
						res.cookie('pass', o.pass, { maxAge: 900000 });	
					}
					res.send('ok', 200);
				}
			});
		}	else if (req.param('logout') === 'true'){
			res.clearCookie('user');
			res.clearCookie('pass');
			req.session.destroy(function(e){ res.send('ok', 200); });
		}
	});
	
// creating new accounts //
	
	app.get('/signup', function(req, res) {
		res.render('signup', {  title: 'Signup', countries : CT });
	});
	
	app.post('/signup', function(req, res){
		if (req.files.image != null) {
			var tmp_path = req.files.image.path;
			
			var target_path = './app/public/img/users/' + req.files.image.name;
			var picture_path = './img/users/' + req.files.image.name;
			fs.rename(tmp_path, target_path, function(err) {
				if(err) throw err;
				fs.unlink(tmp_path, function() {
					if(err) throw err;
				});
			});
		}
		AM.addNewAccount({
			name 	: req.param('name'),
			email 	: req.param('email'),
			city	: ucFirstAllWords(req.param('city')),
			state	: ucFirstAllWords(req.param('state')),
			user 	: req.param('user'),
			pass	: req.param('pass'),
			country : req.param('country'),
			image	: req.param('image'),
			tag_line: req.param('tag_line'),
			description: req.param('description')
		}, function(e){
			if (e){
				res.send(e, 400);
			}	else{
				res.send('ok', 200);
			}
		});
	});

// password reset //

	app.post('/lost-password', function(req, res){
	// look up the user's account via their email //
		AM.getAccountByEmail(req.param('email'), function(o){
			if (o){
				res.send('ok', 200);
				EM.dispatchResetPasswordLink(o, function(e, m){
				// this callback takes a moment to return //
				// should add an ajax loader to give user feedback //
					if (!e) {
					//	res.send('ok', 200);
					}	else{
						res.send('email-server-error', 400);
						for (k in e) console.log('error : ', k, e[k]);
					}
				});
			}	else{
				res.send('email-not-found', 400);
			}
		});
	});

	app.get('/reset-password', function(req, res) {
		var email = req.query["e"];
		var passH = req.query["p"];
		AM.validateResetLink(email, passH, function(e){
			if (e != 'ok'){
				res.redirect('/');
			} else{
	// save the user's email in a session instead of sending to the client //
				req.session.reset = { email:email, passHash:passH };
				res.render('reset', { title : 'Reset Password' });
			}
		})
	});
	
	app.post('/reset-password', function(req, res) {
		var nPass = req.param('pass');
	// retrieve the user's email from the session to lookup their account and reset password //
		var email = req.session.reset.email;
	// destory the session immediately after retrieving the stored email //
		req.session.destroy();
		AM.updatePassword(email, nPass, function(e, o){
			if (o){
				res.send('ok', 200);
			}	else{
				res.send('unable to update password', 400);
			}
		})
	});
	
// view & delete accounts //
	
	app.get('/print', function(req, res) {
		AM.getAllRecords( function(e, accounts){
			res.render('print', { title : 'Account List', accts : accounts });
		})
	});
	
	app.get('/list', function(req, res) {
		var country_array = [];
		var state_array = [];
		var city_array = [];
		var c_counter = 0;
		var c_index = 0;
		var s_counter = 0;
		var s_index = 0;
		var ci_counter = 0;
		var ci_index = 0;
		//var count;

		AM.getAllRecords( function(e, accounts){
			console.log(accounts.length);
			for(var i = 0; i < accounts.length; i++) {
				var cnty = accounts[i].country;
				for(var j = 0; j < country_array.length; j++) {
					if(country_array[j].country == accounts[i].country) {
						c_counter += 1;
						c_index = j;
						//break;
					}
				}
				if(c_counter == 0) {
					new_array = {country: accounts[i].country, country_len: 1};
					country_array.push(new_array);
				}
				else {
					country_array[c_index].country_len += 1;
					c_counter = 0;
				}
				
				for(var k = 0; k < state_array.length; k++) {
					if(state_array[k].state == accounts[i].state) {
						s_counter += 1;
						s_index = k;
					}
				}
				if(s_counter == 0) {
					new_array = {state: accounts[i].state, state_len: 1};
					state_array.push(new_array);
				}
				else {
					state_array[s_index].state_len += 1;
					s_counter = 0;
				}
				
				for(var l = 0; l < city_array.length; l++) {
					if(city_array[l].city == accounts[i].city) {
						ci_counter += 1;
						ci_index = l;
					}
				}
				if(ci_counter == 0) {
					new_array = {city: accounts[i].city, city_len: 1};
					city_array.push(new_array);
				}
				else {
					city_array[ci_index].city_len += 1;
					ci_counter = 0;
				}
					
			}
				/* TODO: Determine async issues with using 'findByMultipleFields'
				
					//var new_cnty = accounts[i].country;
					var object_length = function() {
						var count = AM.findByMultipleFields([{country: 'United States'}], function(e, clist){
							//var new_clist_array = {country: new_cnty, country_len: clist.length};
							//country_array.push(new_clist_array);
							//console.log(country_array);
							//console.log(clist.length);
							return clist.length
						});
						console.log(count);
						return count;
					}
					
					
					
					
					var clist_array = {country: cnty, country_len: count};
					country_array.push(clist_array);
				}
				else {
					c_counter = 0;
				}
			}
			

			console.log(country_array);
			*/
			res.render('list', {accts : accounts, countries: country_array, states: state_array, cities: city_array });
		});
			/*
			for(var i = 1; i < accounts.length; i++) {
				AM.findByMultipleFields
		AM.findByMultipleFields([{country:'Poland'}], function(e, clist){
			if(clist != null) {
				var clist_array = [{country:'Poland', country_len: clist.length}, {'United States': clist.length}];
				for(var i = 0; i < clist_array.length; i++) {
					if(clist_array[i].country == 'Poland') {
						console.log(clist_array[i].country_len);
					}
				}
			}
		
		});
		AM.getAllRecords( function(e, accounts){
			res.render('list', {accts : accounts });
		});
		*/
	});
	
	app.post('/delete', function(req, res){
		AM.deleteAccount(req.body.id, function(e, obj){
			if (!e){
				res.clearCookie('user');
				res.clearCookie('pass');
	            req.session.destroy(function(e){ res.send('ok', 200); });
			}	else{
				res.send('record not found', 400);
			}
	    });
	});
	
	app.get('/reset', function(req, res) {
		AM.delAllRecords(function(){
			res.redirect('/print');	
		});
	});
	
	app.get('/users/:id', function(req, res) {
		AM.findById(req.params.id, function(error, o) {
			res.render('user_page.jade',
				{title: req.param('name'),
					profile: o
				}
				);
		});
	});
	
	app.get('/list/:sta', function(req, res) {
		AM.findByMultipleFields([{state:ucFirstAllWords(req.params.sta)}], function(e, accounts){
			if(accounts != null) {
				res.render('list', {accts: accounts});
			}
		});
	});
	
	app.get('/list/city/:city', function(req, res) {
		AM.findByMultipleFields([{city:ucFirstAllWords(req.params.city)}], function(e, accounts){
			console.log(accounts)
			if(accounts != null) {
				res.render('list', {accts: accounts});
			}
		});
	});
	
	app.get('/list/:sta/:city', function(req, res) {
		AM.findByMultipleFields([{state:ucFirstAllWords(req.params.sta), city:ucFirstAllWords(req.params.city)}], function(e, accounts){
			if(accounts != null) {
				res.render('list', {accts: accounts});
			}
		});
	});
	
	app.post('/users/addComment', function(req, res) {
		AM.addCommentToArticle(req.param('_id'), {
			person: req.param('person'),
			comment: req.param('comment'),
			create_at: new Date()
		}, function(error, docs) {
			res.redirect('/users/' + req.param('_id'))
			});
	});
	
	app.get('*', function(req, res) { res.render('404', { title: 'Page Not Found'}); });

};

function ucFirstAllWords( str )
{
    var pieces = str.split(" ");
    for ( var i = 0; i < pieces.length; i++ )
    {
        var j = pieces[i].charAt(0).toUpperCase();
        pieces[i] = j + pieces[i].substr(1);
    }
    return pieces.join(" ");
}