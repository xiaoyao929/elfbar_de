define(["jquery"], function($){
  return function(config, element){
    var minicart = $(element);
    minicart.on('contentLoading', function () {
      minicart.on('contentUpdated', function () {
        minicart.find('[data-role="dropdownDialog"]').dropdownDialog("open");
      });
    });
  }
});
