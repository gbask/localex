
function SignupController()
{
	var that = this;
// redirect to homepage when cancel button is clicked //
	$('#account-form-btn1').click(function(){ window.location.href = '/';});

// redirect to homepage on new account creation, add short delay so user can read alert window //
	$('.modal-alert #ok').click(function(){ 
		that.nextPage();
	});
	
	this.nextPage = function()
	{
		$('.modal-confirm').modal('hide');
		var that = this;
		
		$.ajax({
			url: '/home',
			type: 'GET',
			data: {new_profile: true, user:$('#user-tf').val(), pass:$('#pass-tf').val()},
			success: function(data){	
				console.log('Added a Profile!');
			},
			error: function(jqXHR){
				console.log(jqXHR.responseText+' :: '+jqXHR.statusText);
			}
			
		});
		
	}
}