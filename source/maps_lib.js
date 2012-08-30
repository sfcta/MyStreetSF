/*!
 * Searchable Map Template with Google Fusion Tables
 * http://derekeder.com/searchable_map_template/
 *
 * Copyright 2012, Derek Eder
 * Licensed under the MIT license.
 * https://github.com/derekeder/FusionTable-Map-Template/wiki/License
 *
 * Date: 8/15/2012
 * 
 */
 
var MapsLib = MapsLib || {};
var MapsLib = {
  
  //Setup section - put your Fusion Table details here
  //Using the v1 Fusion Tables API. See https://developers.google.com/fusiontables/docs/v1/migration_guide for more info
  
  //the encrypted Table ID of your Fusion Table (found under File => About)
  //NOTE: numeric IDs will be depricated soon
  fusionTableId:      "1-pdSEaE-xu36mhCGCt41U8m--5vwaM7ww-kz6Ko",  
  
  //*New Fusion Tables Requirement* API key. found at https://code.google.com/apis/console/      
  googleApiKey:       "AIzaSyDSscDrdYK3lENjefyjoBof_JjXY5LJLRo",        
  
  locationColumn:     "Geometry",     //name of the location column in your Fusion Table
  map_centroid:       new google.maps.LatLng(37.7750, -122.4183), //center that your map defaults to
  locationScope:      "San+Francisco",//geographical area appended to all address searches
  recordName:         "result",       //for showing number of results
  recordNamePlural:   "results", 
  
  searchRadius:       805,            //in meters ~ 1/2 mile
  defaultZoom:        12,             //zoom level when map is loaded (bigger is more zoomed in)
  currentPinpoint: null,
  
  initialize: function() {
    if (gapi.client.fusiontables == null) {
  	  gapi.client.setApiKey(MapsLib.googleApiKey);
      gapi.client.load('fusiontables', 'v1', MapsLib.fusiontablesLoaded);

    }
  
    $( "#resultCount" ).html("");
  
    geocoder = new google.maps.Geocoder();
    var myOptions = {
      zoom: MapsLib.defaultZoom,
      center: MapsLib.map_centroid,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    };
    MapsLib.map = new google.maps.Map($("#mapCanvas")[0],myOptions);
    
    MapsLib.searchrecords = null;
    
    //reset filters
    if ($.address != null) {
      $("#txtSearchAddress").val(MapsLib.convertToPlainString($.address.parameter('address')));
      var loadRadius = MapsLib.convertToPlainString($.address.parameter('radius'));
    }
    if (loadRadius != "") $("#ddlRadius").val(loadRadius);
    else $("#ddlRadius").val(MapsLib.searchRadius);
    $("#district").prop("selectedIndex", 0);
    $("#project-type").prop("selectedIndex", 0);
    $(":checkbox").prop("checked", true);
		$("#slider").slider( "option", "value", 100 );
		MapsLib.slide(null, null);
    $("#resultCount").hide();
     
    //run the default search
    MapsLib.doSearch();
  },
  
  doSearch: function(location) {
    MapsLib.clearSearch();
    var address = $("#txtSearchAddress").val();
    MapsLib.searchRadius = $("#ddlRadius").val();

    var whereClause = MapsLib.locationColumn + " not equal to ''";
    
    //-----filter by district-------    
    var district = $("#district").val();
		if (district != "All") {
		  whereClause += " AND District"+district+"=1";
		}
    //-------end of filter by district code--------
		
		//-----filter by funding source-------
    //best way to filter results by a type is to create a 'type' column and assign each row a number (strings work as well, but numbers are faster). then we can use the 'IN' operator and return all that are selected
    whereClause += " AND 'Funding Source Code' IN (0,";
    if ( $("#FSPropK").is(':checked')) 		whereClause += "4,5,6,7,";  // binary: 4-bit is on
    if ( $("#FSTFCA").is(':checked')) 		whereClause += "2,3,6,7,";  // binary: 2-bit is on
    if ( $("#FSRegStFed").is(':checked')) whereClause += "1,3,5,7,";  // binary: 1-bit is on
    // trim comma
    whereClause = whereClause.substr(0,whereClause.length-1);
    // close paren
    whereClause += ")";
    
		//-----end of filter by funding source-------
		
		//-----filter by project type-------
    var ptype = $("#project-type").val();
		if (ptype != "All") {
		  whereClause += " AND 'Project Type'='"+ptype + "'";
		}
    //-----end of filter by project type-------
    
		//-----filter by project sponsor-------    
    var psponsor = $("#project-sponsor").val();
    if (psponsor != "All") {
    	whereClause += " AND 'Sponsor'='" + psponsor + "'";
    }
    //-----end of filter by project sponsor-------    
    

		//-----filter by completion date-------
		if (MapsLib.slideDate != null) {
			whereClause += " AND 'Expected Completion Date' <= '" + 
				MapsLib.slideDate.getFullYear() + "." + (MapsLib.slideDate.getMonth()+1) + "." + MapsLib.slideDate.getDate() + "'";
		}
    //-----end of filter by completion date-------		
    
    if (address != "") {
      if (address.toLowerCase().indexOf(MapsLib.locationScope) == -1)
        address = address + " " + MapsLib.locationScope;
  
      geocoder.geocode( { 'address': address}, function(results, status) {
        if (status == google.maps.GeocoderStatus.OK) {
          MapsLib.currentPinpoint = results[0].geometry.location;
          
          $.address.parameter('address', encodeURIComponent(address));
          $.address.parameter('radius', encodeURIComponent(MapsLib.searchRadius));
          MapsLib.map.setCenter(MapsLib.currentPinpoint);
          MapsLib.map.setZoom(14);
          
          MapsLib.addrMarker = new google.maps.Marker({
            position: MapsLib.currentPinpoint, 
            map: MapsLib.map, 
            animation: google.maps.Animation.DROP,
            title:address
          });
          
          whereClause += " AND ST_INTERSECTS(" + MapsLib.locationColumn + ", CIRCLE(LATLNG" + MapsLib.currentPinpoint.toString() + "," + MapsLib.searchRadius + "))";
          
          MapsLib.drawSearchRadiusCircle(MapsLib.currentPinpoint);
          MapsLib.submitSearch(whereClause, MapsLib.map, MapsLib.currentPinpoint);
        } 
        else {
          alert("We could not find your address: " + status);
        }
      });
    }
    else { //search without geocoding callback
      MapsLib.submitSearch(whereClause, MapsLib.map);
    }
  },
  
  submitSearch: function(whereClause, map, location) {
		// keep the whereClause for the displayCount
		MapsLib.whereClause = whereClause;
    console.log("whereClause = " + whereClause);

    //get using all filters
    MapsLib.searchrecords = new google.maps.FusionTablesLayer({
      query: {
        from:   MapsLib.fusionTableId,
        select: MapsLib.locationColumn,
        where:  whereClause
      }
    });
    MapsLib.searchrecords.setMap(map);
    MapsLib.displayCount();
  },
  
  clearSearch: function() {
    if (MapsLib.searchrecords != null)
      MapsLib.searchrecords.setMap(null);
    if (MapsLib.addrMarker != null)
      MapsLib.addrMarker.setMap(null);  
    if (MapsLib.searchRadiusCircle != null)
      MapsLib.searchRadiusCircle.setMap(null);
  },
  
  findMe: function() {
    // Try W3C Geolocation (Preferred)
    var foundLocation;
    
    if(navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function(position) {
        foundLocation = new google.maps.LatLng(position.coords.latitude,position.coords.longitude);
        MapsLib.addrFromLatLng(foundLocation);
      }, null);
    }
    else {
      alert("Sorry, we could not find your location.");
    }
  },
  
  addrFromLatLng: function(latLngPoint) {
    geocoder.geocode({'latLng': latLngPoint}, function(results, status) {
      if (status == google.maps.GeocoderStatus.OK) {
        if (results[1]) {
          $('#txtSearchAddress').val(results[1].formatted_address);
          $('.hint').focus();
          MapsLib.doSearch();
        }
      } else {
        alert("Geocoder failed due to: " + status);
      }
    });
  },
  
  drawSearchRadiusCircle: function(point) {
      var circleOptions = {
        strokeColor: "#4b58a6",
        strokeOpacity: 0.3,
        strokeWeight: 1,
        fillColor: "#4b58a6",
        fillOpacity: 0.05,
        map: MapsLib.map,
        center: point,
        clickable: false,
        zIndex: -1,
        radius: parseInt(MapsLib.searchRadius)
      };
      MapsLib.searchRadiusCircle = new google.maps.Circle(circleOptions);
  },
  
  query: function(selectColumns, whereClause, callback) {
    var queryStr = [];
    queryStr.push("SELECT " + selectColumns);
    queryStr.push(" FROM " + MapsLib.fusionTableId);
    queryStr.push(" WHERE " + whereClause);
  
    var sql = encodeURIComponent(queryStr.join(" "));
    $.ajax({url: "https://www.googleapis.com/fusiontables/v1/query?sql="+sql+"&callback="+callback+"&key="+MapsLib.googleApiKey, dataType: "jsonp"});
  },
  
  displayCount: function() {
 		// wait until this is defined -- the client has loaded the API
 		if (gapi.client.fusiontables == null) {
 		  console.log("displayCount fusiontables not defined yet");
 		  // try again in a bit ?
 		  return;
 		}

	  var query = 'select count() from "'+MapsLib.fusionTableId + '"';
    if (MapsLib.whereClause != "") {query += ' where ' + MapsLib.whereClause;}
    console.log(query);
		var request = gapi.client.fusiontables.query.sqlGet({'sql': query});
		request.execute(MapsLib.displaySearchCount);
		
    // MapsLib.query(selectColumns, whereClause,"MapsLib.displaySearchCount");
  },
  
  displaySearchCount: function(json) { 

    var numRows = 0;
    if (json["rows"] != null)
      numRows = json["rows"][0];
    
    var name = MapsLib.recordNamePlural;
    if (numRows == 1) { name = MapsLib.recordName; }
    $( "#resultCount" ).fadeOut(function() {
        $( "#resultCount" ).html(MapsLib.addCommas(numRows) + " " + name + " found");
      });
    $( "#resultCount" ).fadeIn();
  },
  
  addCommas: function(nStr) {
    nStr += '';
    x = nStr.split('.');
    x1 = x[0];
    x2 = x.length > 1 ? '.' + x[1] : '';
    var rgx = /(\d+)(\d{3})/;
    while (rgx.test(x1)) {
      x1 = x1.replace(rgx, '$1' + ',' + '$2');
    }
    return x1 + x2;
  },
  
  //converts a slug or query string in to readable text
  convertToPlainString: function(text) {
    if (text == undefined) return '';
  	return decodeURIComponent(text);
  },
 
  // callback for when the gapi.client.fusiontables are loaded
  fusiontablesLoaded: function() {
 		console.log('fusiontables client api loaded.');
 		// load the dates for the query Slider
    MapsLib.querySliderDates();
    // load the query count for the results found display
    MapsLib.displayCount();
    // load the legend info
    MapsLib.queryLegend();
  },

  queryLegend: function() {
    var query = "select 'Project Type',Shape,'Icon_Name' from "+MapsLib.fusionTableId+" ORDER BY 'Project Type'";
    var request = gapi.client.fusiontables.query.sqlGet({'sql':query});
    request.execute(MapsLib.displayLegend);
  },
  
  displayLegend: function(json) {
    // console.log(json);
    
    // this is adapted from 
    // http://gmaps-samples.googlecode.com/svn/trunk/fusiontables/dynamic_styling_template.html
    var legendDiv = document.createElement('div');
    var legend = new Legend(legendDiv, json);
    // console.log(legendDiv.innerHTML);
    legendDiv.index = 1;
    //MapsLib.map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].pop();
    MapsLib.map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(legendDiv);
  },
  
  
  querySliderDates: function() {
    var query = "select MINIMUM('Expected Completion Date'),MAXIMUM('Expected Completion Date') from "+MapsLib.fusionTableId;
    // console.log(query);
	  var request = gapi.client.fusiontables.query.sqlGet({'sql': query});
		request.execute(MapsLib.setSliderMinMaxDates);
  },
  
  // saves the min and max dates for the slider
  setSliderMinMaxDates: function(json) {
  	// console.log(json["rows"][0]);
  	MapsLib.minDate = new Date(json["rows"][0][0]);
  	MapsLib.maxDate = new Date(json["rows"][0][1]);
  	MapsLib.diffDate = MapsLib.maxDate.getTime() - MapsLib.minDate.getTime();
  	MapsLib.slideDate = MapsLib.maxDate;
  	$("#slide-min-date").html((MapsLib.minDate.getMonth()+1) + "/" + MapsLib.minDate.getFullYear());
  	$("#slide-max-date").html((MapsLib.maxDate.getMonth()+1) + "/" + MapsLib.maxDate.getFullYear());
  	
  	$("#slide-date").html((MapsLib.slideDate.getMonth()+1) + "/" + MapsLib.slideDate.getFullYear());
  },
  
  // callback for slider movements, this just updates the text label
  slide: function(event, ui) {
    if (MapsLib.minDate == null) { return; }
    
    var ui_value = 100;
    if (ui != null) { ui_value = ui.value; }
        
	  // ui.value is in [0,100]
	  // find the date matching in seconds
		var newDate = new Date(MapsLib.minDate.getTime() + Math.round(ui_value/100.0*MapsLib.diffDate));
		// last day of the month
		// console.log("original: " + newDate);  	
		newDate.setMonth(newDate.getMonth()+1);
		newDate.setDate(0);
		// console.log("using: " + newDate);
		MapsLib.slideDate = newDate;
  	$("#slide-date").html((MapsLib.slideDate.getMonth()+1) + "/" + MapsLib.slideDate.getFullYear());
	},
	
	// callback for slider changes (after it's stopped moving)
	slideChange: function(event, ui) {
		// console.log(ui.value);
		MapsLib.doSearch();
	}
}

// Generate the content for the legend
function Legend(controlDiv, json) {
  console.log("Legend!");
  controlDiv.style.padding = '10px';
  var controlUI = document.createElement('div');
  controlUI.style.backgroundColor = 'white';
  controlUI.style.borderStyle = 'solid';
  controlUI.style.borderWidth = '1px';
  controlUI.style.width = '150px';
  controlUI.title = 'Legend';
  controlDiv.appendChild(controlUI);
  var controlText = document.createElement('div');
  controlText.style.fontFamily = 'Arial,sans-serif';
  controlText.style.fontSize = '12px';
  controlText.style.paddingLeft = '4px';
  controlText.style.paddingRight = '4px';

  controlText.innerHTML = legendContent(json);
  controlUI.appendChild(controlText);
}

function legendContent(json) {
  // Generate the content for the legend using colors from object
  var controlTextList = new Array();
  controlTextList.push('<p><b>');
  controlTextList.push("Legend");
  controlTextList.push('</b></p>');
  // console.log(json);
  
  var done_set = {} // project types that are done
  for(rownum in json["rows"]) {
    // each row = Project Type, Shape, icon name

		// ignore empties
    if (json["rows"][rownum][2] == '') { continue; }

		// ignore if we've done it already
		if (done_set.hasOwnProperty(json["rows"][rownum][0])) { continue; }
		 
    console.log(json["rows"][rownum]);
    var shape = json["rows"][rownum][1];
    var icon  = json["rows"][rownum][2];
    var color = json["rows"][rownum][2];
    
    // icon images are here: https://groups.google.com/forum/?fromgroups=#!starred/fusion-tables-users-group/Zwoq9xivyXs
    controlTextList.push('<div style="height: 20px; width: 20px; margin: 3px; float: left;">');
    if (shape=="Polyline") {
      controlTextList.push('<div style="margin-top:7px; height:2px; width:20px; opacity:0.6; background-color:'+color+'"></div>');
    }
    else if (shape=="Point" && icon=="small_red") {
    	controlTextList.push('<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAJCAYAAADgkQYQAAAAiklEQVR42mNgQIAoIF4NxGegdCCSHAMzEC+NUlH5v9rF5f+ZoCAwHaig8B8oPhOmKC1NU/P//7Q0DByrqgpSGAtSdOCAry9WRXt9fECK9oIUPXwYFYVV0e2ICJCi20SbFAuyG5uiECUlkKIQmOPng3y30d0d7Lt1bm4w301jQAOgcNoIDad1yOEEAFm9fSv/VqtJAAAAAElFTkSuQmCC">');
    }
    else if (shape=="Point" && icon=="small_yellow") {
      controlTextList.push('<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAJCAYAAADgkQYQAAAAi0lEQVR42mNgQIAoIF4NxGegdCCSHAMzEC+NijL7v3p1+v8zZ6rAdGCg4X+g+EyYorS0NNv////PxMCxsRYghbEgRQcOHCjGqmjv3kKQor0gRQ8fPmzHquj27WaQottEmxQLshubopAQI5CiEJjj54N8t3FjFth369ZlwHw3jQENgMJpIzSc1iGHEwB8p5qDBbsHtAAAAABJRU5ErkJggg==">');
    }
    else if (shape=="Point" && icon=="small_green") {
      controlTextList.push('<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAJCAYAAADgkQYQAAAAiElEQVR42mNgQIAoIF4NxGegdCCSHAMzEC81izL7n746/X/VmSowbRho+B8oPhOmKM02zfb/TCzQItYCpDAWpOhA8YFirIoK9xaCFO0FKXrY/rAdq6Lm280gRbeJNikWZDc2RUYhRiBFITDHzwf5LmtjFth3GesyYL6bxoAGQOG0ERpO65DDCQDX7ovT++K9KQAAAABJRU5ErkJggg==">');
    }
    else if (shape=="Point" && icon=="small_blue") {
      controlTextList.push('<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAJCAYAAADgkQYQAAAAiklEQVR42mNgQIAoIF4NxGegdCCSHAMzEC81M4v6n56++n9V1RkwbWgY+B8oPhOmKM3WNu3/zJn/MbCFRSxIYSxI0YHi4gNYFRUW7gUp2gtS9LC9/SFWRc3Nt0GKbhNtUizIbmyKjIxCQIpCYI6fD/JdVtZGsO8yMtbBfDeNAQ2AwmkjNJzWIYcTAMk+i9OhipcQAAAAAElFTkSuQmCC">');
    }
    else if (shape=="Point" && icon=="small_purple") {
    	controlTextList.push('<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAJCAYAAADgkQYQAAAAi0lEQVR42mNgQIAoIF4NxGegdCCSHAMzEC+NMov6vzp99f8zVWfAdKBh4H+g+EyYorQ027T//2f+x8CxFrEghbEgRQcOFB/Aqmhv4V6Qor0gRQ8ftj/Equh2822QottEmxQLshubohCjEJCiEJjj54N8tzFrI9h36zLWwXw3jQENgMJpIzSc1iGHEwBt95qDejjnKAAAAABJRU5ErkJggg==">');
    }
    else {
      console.log("unknown icon: " + json["rows"][rownum][2]);
    }
    controlTextList.push('</div>');
    controlTextList.push(json["rows"][rownum][0]);
    controlTextList.push('<br style="clear: both;"/>');
    
    done_set[json["rows"][rownum][0]] = 1;
  }

  controlTextList.push('<br />');
  return controlTextList.join('');
}