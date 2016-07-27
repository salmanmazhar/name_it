"use strict";


// Global
var OnChangeTimeout = 300; // ms
var ListThumbSize = 100;
var PopupThumbSize = 400;
var DefaultThumb = "";
var BingClientSec = "q3w6XS7A6qk9asSBePAJr6ZhkrG7YRFZrt4zGad9zPWQ7TgtrWVeSM9wpr6WF4ty";
var BingClientID = "nameit-translator";


angular.module('app.controllers', [])

.filter('listSortFilter', function () {
  return function (items) {
    var sortable = [];
    for (var key in items){ sortable.push(items[key]); }
    sortable.sort( function(a, b) { return a.rank - b.rank; } );
    return sortable;
  };
})

.controller('nameItCtrl', function($scope, $http, $q, $ionicPopup, $ionicScrollDelegate, focus) {

  // Local vars
  $scope.list = {};
  $scope.languages = LANGUAGES;
  var canceler = $q.defer();
  $scope.log = [];
  localStorage['bingToken-expires'] = new Date();

  // Initialize the language selection
  $scope.initLangSelection = function(){
    if(!('lang-from' in localStorage)){
      // defaults
      localStorage['lang-from'] = 'en';
      localStorage['lang-to'] = 'de';
    }
    $scope.langFromSelected = localStorage['lang-from'];
    $scope.langToSelected = localStorage['lang-to'];
  }();

  $scope.langFromChanged = function(code){
    console.log(code);
    localStorage['lang-from'] = code;
    $scope.textArea = "";
    $scope.list = {};
    $ionicScrollDelegate.scrollTop();
    focus('input');
  }

  $scope.langToChanged = function(code){
    console.log(code);
    localStorage['lang-to'] = code;
    $ionicScrollDelegate.scrollTop();
    $scope.updateList($scope.textArea);
  }

  $scope.swapLanguages = function(){
    // Swap language selection in memory
    var lf = localStorage['lang-from'];
    localStorage['lang-from'] = localStorage['lang-to'];
    localStorage['lang-to'] = lf;

    $scope.langFromSelected = localStorage['lang-from'];
    $scope.langToSelected = localStorage['lang-to'];
    $scope.updateList($scope.textArea);
  }

  $scope.kbButtonClicked = function(){
    focus('input');
  }

  $scope.updateList = function(text){
    if(text=="" || typeof text == "undefined")
    return;
    console.log(text);
    $('#loading').removeClass("invisible");
    var url = "https://"+localStorage['lang-from']+".wikipedia.org/w/api.php?callback=JSON_CALLBACK&action=opensearch&redirects=resolve&limit=10&search="+text;
    $http.jsonp(url, {timeout: canceler.promise, cache: true}).
    success(function(result, status, headers, config) {
      $scope.getProperties(result[1], result[2]);
    }).
    error(function(data, status, headers, config) {
      $scope.showError(status, data);
    });

  }

  $scope.getProperties = function(titles, snippets){
    $scope.list = {};
    var pending = titles.length;

    function seq(i){
      //console.log(i);
      var url = "https://"+localStorage['lang-from']+".wikipedia.org/w/api.php?callback=JSON_CALLBACK&action=query&prop=pageterms|pageimages|links&format=json&pithumbsize="+ListThumbSize+"&pllimit=max&titles="+titles[i];
      $http.jsonp(url, {timeout: canceler.promise, cache: true}).
      success(function(res, status, headers, config) {
        var page = first(res.query.pages)
        // Get page description
        var descr = "no description";
        if(page.hasOwnProperty('terms') && page.terms.hasOwnProperty('description') && page.terms.description.length>0){
          descr = page.terms.description[0];
        }
        // Check if this is Wikipedia disambiguation page
        var links = [];
        if(descr.toLowerCase().includes(DISAMBIGUATIONS[localStorage['lang-from']].toLowerCase())){
          if($scope.textArea != ""){
            $scope.disambiguate(titles[i], page.links, i);
          }
        } else {
          // Get thumbnail
          var thumb = DefaultThumb;
          if(page.hasOwnProperty('thumbnail')){
            thumb = page.thumbnail.source;
          }

          $scope.list[titles[i]] = {
            rank: i,
            title: titles[i],
            //snippet: snippets[i],
            descr: descr,
            img: thumb,
            trans: []
          };

          $scope.getTranslations(titles[i]);
        }

        pending--;
        if(pending>0){
          seq(i+1);
        }
      }).
      error(function(data, status, headers, config) {
        $scope.showError(status, data);
      });

    };
    seq(0);
  }

  $scope.disambiguate = function(ambiguousTitle, links, rank){
    links.forEach(function(link, i){
      var title = link['title'];
      //console.log(title);
      var re = new RegExp("^"+ambiguousTitle+" [(][a-z|A-Z]+[)]$");
      var matched = re.test(title);
      if(matched){
        //console.warn(title);
        var url = "https://"+localStorage['lang-from']+".wikipedia.org/w/api.php?callback=JSON_CALLBACK&action=query&redirects&prop=pageterms|pageimages&format=json&pithumbsize="+ListThumbSize+"&titles="+title;
        $http.jsonp(url, {timeout: canceler.promise, cache: true}).
        success(function(res, status, headers, config) {
          var page = first(res.query.pages)
          // Get page description
          var descr = "no description";
          if(page.hasOwnProperty('terms') && page.terms.hasOwnProperty('description') && page.terms.description.length>0){
            descr = page.terms.description[0];
          }
          // Get thumbnail
          var thumb = DefaultThumb;
          if(page.hasOwnProperty('thumbnail')){
            thumb = page.thumbnail.source;
          }

          $scope.list[title] = {
            rank: rank,
            title: title,
            //snippet: snippets[i],
            descr: descr,
            img: thumb,
            trans: [],
            bing: "",
          } ;

          $scope.getTranslations(title);
        }).
        error(function(data, status, headers, config) {
          $scope.showError(status, data);
        });

      }
    });
  }

  $scope.getTranslations = function(title) {
    var url = "https://"+localStorage['lang-from']+".wikipedia.org/w/api.php?callback=JSON_CALLBACK&action=query&prop=langlinks&lllang="+localStorage['lang-to']+"&format=json&titles="+title;
    $http.jsonp(url, {timeout: canceler.promise, cache: true}).
    success(function(res, status, headers, config) {
      var page = first(res.query.pages);
      var word = "";
      if(page.hasOwnProperty('langlinks') && page.langlinks.length>0 && page.langlinks[0].hasOwnProperty('*')){
        word = page.langlinks[0]['*'];
      }

      if(word != ""){
        if($scope.list.hasOwnProperty(title)){
          $scope.list[title].trans.push(word);
          $scope.getSynonyms(title, word);
        }
      } else {
        // No match in the destination language
        // if($scope.list.hasOwnProperty(title)){
        //   //delete $scope.list[title];
        //   $scope.list[title].trans.push("No match");
        //   $('#loading').addClass("invisible");
        // }
        $scope.getBingTranslation(title, word);
      }
    }).
    error(function(data, status, headers, config) {
      $scope.showError(status, data);
    });

  }


  $scope.getSynonyms = function(title, word){
    var url = "https://"+localStorage['lang-to']+".wikipedia.org/w/api.php?callback=JSON_CALLBACK&action=query&list=backlinks&format=json&blfilterredir=redirects&bltitle="+word;
    $http.jsonp(url, {timeout: canceler.promise, cache: true}).
    success(function(res, status, headers, config) {
      res.query.backlinks.forEach(function(backlink){
        if($scope.list.hasOwnProperty(title)){
          $scope.list[title].trans.push(backlink.title);
          //$('#loading').addClass("invisible");
        }
      });
      $scope.getBingTranslation(title, word);
    }).
    error(function(data, status, headers, config) {
      $scope.showError(status, data);
    });

  }

  $scope.getBingToken = function(){
    var url = "https://datamarket.accesscontrol.windows.net/v2/OAuth2-13/";
    $http({
      method: 'POST',
      url: url,
      timeout: canceler.promise,
      cache: true,
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      transformRequest: function(obj) {
        var str = [];
        for(var p in obj){
          str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
        }
        return str.join("&");
      },
      data: {
        'client_id': BingClientID,
        'client_secret': BingClientSec,
        'scope': "http://api.microsofttranslator.com",
        'grant_type': 'client_credentials'
      }
    }).
    success(function(res, status, headers, config) {
      console.log("Renewed bing token");
      //$scope.log.push("renewed"); $scope.$apply();
      localStorage['bingToken'] = res.access_token;
      var expires = parseInt(res.expires_in);
      localStorage['bingToken-expires'] = new Date(new Date().getTime() + (expires-60)*1000);
    }).
    error(function(data, status, headers, config) {
      $scope.showError(status, data);
    });
  };
  setInterval(function(){
    if(Date.parse(localStorage['bingToken-expires']) < new Date() && ionic.Platform.platforms[0] != "browser"){
      //$scope.log.push("Expired @"+ localStorage['bingToken-expires']);
      $scope.getBingToken();
    }
  }, 1000);


  $scope.getBingTranslation = function(title){
    if(typeof localStorage['bingToken'] == "undefined"){
      $scope.list[title].bing = "bing translation";
      return;
    }
    var token = encodeURIComponent("Bearer "+localStorage['bingToken']);
    var url = "https://api.microsofttranslator.com/V2/Ajax.svc/Translate?appId="+token+"&from="+localStorage['lang-from']+"&to="+localStorage['lang-to']+"&text="+title;
    console.log(url);
    $http.get(url, {timeout: canceler.promise, cache: true}).
    success(function(res, status, headers, config) {
      if($scope.list.hasOwnProperty(title)){
        if(res.includes("Exception")){
          $scope.list[title].bing = "bing exception";
        } else {
          $scope.list[title].bing = res.replace(/['"]+/g, '');
        }
        $('#loading').addClass("invisible");
      }
    }).
    error(function(data, status, headers, config) {
      //$scope.showError("bing "+status, data);
      //$scope.log.push("getBingTranslation:"+status);
      $('#loading').addClass("invisible");
    });

  }

  $scope.inputChanged = function() {
    clearTimeout($scope.inputChangedResponse);
    canceler.resolve();
    canceler = $q.defer();
    $('#loading').addClass("invisible");

    if($scope.textArea == ""){
      $ionicScrollDelegate.scrollTop();
      $scope.list = {};
      return;
    }

    $scope.inputChangedResponse = setTimeout(function(){
      $('#loading').removeClass("invisible");
      $ionicScrollDelegate.scrollTop();
      $scope.updateList($scope.textArea);
    }, OnChangeTimeout);
  }

  //popUp for showing details of list item
  $scope.showPopup = function(title, lang) {

    if(lang=='to' && $scope.list[title].trans.length>0 && $scope.list[title].trans[0] != 'No match'){
      title = $scope.list[title].trans[0];
    } else if (lang=='to') {
      return;
    }

    var url = "https://"+localStorage['lang-'+lang]+".wikipedia.org/w/api.php?callback=JSON_CALLBACK&format=json&action=query&redirects&prop=extracts|pageimages&exintro=&explaintext=&pithumbsize="+PopupThumbSize+"&titles="+title;
    url = encodeURI(url);
    $http.jsonp(url, {timeout: canceler.promise, cache: true}).
    success(function(res, status, headers, config) {
      var page = first(res.query.pages);
      // Get thumbnail
      var thumb = "";
      if(page.hasOwnProperty('thumbnail')){
        thumb = page.thumbnail.source;
      }
      $scope.article = {
        title: title,
        img: thumb,
        summary: page.extract
      };

      $ionicPopup.alert({
        //title: title,
        cssClass:'ni-details-alert',
        templateUrl: 'popup-template.html',
        scope: $scope,
        buttons: [
          {
            text: 'Close',
            type: 'button-clear button-positive',
          },
          {
            text: 'Goto Wikipedia',
            type: 'button-clear button-dark',
            onTap: function(e) {
              var url = "https://"+localStorage['lang-'+lang]+".wikipedia.org/wiki/"+title;
              window.open(url, '_system');
            }
          }
        ]
      });

    }).
    error(function(data, status, headers, config) {
      $scope.showError(status, data);
    });

  };

  $scope.showError = function(title, message) {
    if(title==0){
      console.log("http "+title+": ", message);
      return;
    }
    $scope.list = [];
    $("#loading").addClass("invisible");
    $ionicPopup.alert({
      title: 'Error ' + title,
      template: message
    }).then(function(res) {
      console.warn("App Error "+title+": ", message);
    });
  };

}) // end controller


// Returns value of the first object
var first = function(objs){
  var value;
  $.each(objs, function(k,v){
    value = v;
    return false;
  });
  return value;
}
