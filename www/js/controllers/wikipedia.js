/* Wikipedia Controller */
app.wikipediaCtrl = function($scope, $http)
{
  // Local vars
  $scope.languages = LANGUAGES;

  $scope.updateList = function(text){
    if(text=="" || typeof text == "undefined"){
      return;
    }
    console.log(text);
    $('#loading').removeClass("invisible");
    var url = "https://"+localStorage['lang-from']+".wikipedia.org/w/api.php?callback=JSON_CALLBACK&action=opensearch&redirects=resolve&limit=10&search="+text;
    $http.jsonp(url, {timeout: $scope.canceler.promise, cache: true}).
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
      $http.jsonp(url, {timeout: $scope.canceler.promise, cache: true}).
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
        $http.jsonp(url, {timeout: $scope.canceler.promise, cache: true}).
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
    $http.jsonp(url, {timeout: $scope.canceler.promise, cache: true}).
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
    $http.jsonp(url, {timeout: $scope.canceler.promise, cache: true}).
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
}

// Returns value of the first object
var first = function(objs){
  var value;
  $.each(objs, function(k,v){
    value = v;
    return false;
  });
  return value;
}