angular.module('app.directives', [])

.directive('focusOn', function() {
   return function(scope, elem, attr) {
      scope.$on('focusOn', function(e, name) {
        if(name === attr.focusOn) {
          elem[0].focus();
        }
      });
   };
});


// .directive('blankDirective', [function(){
//
// }]);
