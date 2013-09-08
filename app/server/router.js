
var CT = require('./modules/country-list');
var AM = require('./modules/account-manager');
var EM = require('./modules/email-dispatcher');

var fs = require('fs');
var url = require('url');
var homepage_buf = new Buffer(fs.readFileSync('app/server/views/index.html'));
var contact_buf = new Buffer(fs.readFileSync('app/server/views/contact.html'));

module.exports = function(app) {

// home page //
	app.get('/', function(req, res){
		res.send(homepage_buf.toString('utf-8'));
		var queryObject = url.parse(req.url,true).query;
		
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
		if (req.param('new_profile') == 'true') {
			AM.manualLogin(req.param('user'), req.param('pass'), function(e, o) {
				if(!o) {
					console.log('failing');
					res.send(e, 400);
				} else {
					console.log('made it success');
					req.session.user = o;
					res.redirect('/login');
					//res.send(o, 200);
					console.log(req.session.user);
					
				}
			});
	    } else if (req.session.user === null){
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
		if(req.param('new_pic') === 'true') {
			AM.updateImage({
				user 		: req.param('user'),
				image		: req.param('image')
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
		} else if (req.param('user') != undefined ) {
			AM.updateAccount({
				user 		: req.param('user'),
				name 		: req.param('name'),
				email 		: req.param('email'),
				city		: ucFirstAllWords(req.param('city')),
				state		: ucFirstAllWords(req.param('state')),
				country 	: req.param('country'),
				pass		: req.param('pass'),
				image		: req.param('image'),
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
		} else if (req.param('logout') === 'true'){
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
		AM.addNewAccount({
			name 	: req.param('name'),
			email 	: req.param('email'),
			city	: ucFirstAllWords(req.param('city')),
			state	: ucFirstAllWords(req.param('state')),
			user 	: req.param('user'),
			pass	: req.param('pass'),
			country : req.param('country')
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
		AM.getAllRecords( function(e, accounts){
			AM.populateLocationCountTables(accounts, function(e, c_array, s_array, ci_array) {
				res.render('list', {accts : accounts, countries: c_array, states: s_array, cities: ci_array });
			});
		});
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
	/*
	app.get('/reset', function(req, res) {
		AM.delAllRecords(function(){
			res.redirect('/print');	
		});
	});
	*/
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
				AM.populateLocationCountTables(accounts, function(e, c_array, s_array, ci_array) {
					res.render('list', {accts : accounts, countries: c_array, states: s_array, cities: ci_array });
				});
			}
		});
	});
	
	app.get('/list/city/:city', function(req, res) {
		AM.findByMultipleFields([{city:ucFirstAllWords(req.params.city)}], function(e, accounts){
			if(accounts != null) {
				AM.populateLocationCountTables(accounts, function(e, c_array, s_array, ci_array) {
					res.render('list', {accts : accounts, countries: c_array, states: s_array, cities: ci_array });
				});
			}
		});
	});
	
	app.get('/list/country/:country', function(req, res) {
		AM.findByMultipleFields([{country:ucFirstAllWords(req.params.country)}], function(e, accounts){
			if(accounts != null) {
				AM.populateLocationCountTables(accounts, function(e, c_array, s_array, ci_array) {
					res.render('list', {accts : accounts, countries: c_array, states: s_array, cities: ci_array });
				});
			}
		});
	});
	
	app.get('/list/:sta/:city', function(req, res) {
		AM.findByMultipleFields([{state:ucFirstAllWords(req.params.sta), city:ucFirstAllWords(req.params.city)}], function(e, accounts){
			if(accounts != null) {
				AM.populateLocationCountTables(accounts, function(e, c_array, s_array, ci_array) {
					res.render('list', {accts : accounts, countries: c_array, states: s_array, cities: ci_array });
				});
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