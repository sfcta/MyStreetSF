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

var defaultDir = '/sites/default/files/interactivemap/';

var INFOWINDOW_HTML = "<div class='googft-info-window'>\n";
INFOWINDOW_HTML += "<table class='map_info'>\n";
INFOWINDOW_HTML += '<tr><th>Project Name</th><td colspan="2"><a target="_blank" href="{Project Details Page}">{Project Name}</a></td></tr>\n';
INFOWINDOW_HTML += '<tr><th>Project Type</th><td colspan="2">{Project Type}</td></tr>\n';
INFOWINDOW_HTML += '<tr><th>Description</th><td colspan="2">{Description}</td></tr>\n';
INFOWINDOW_HTML += '<tr><th>Project Location</th><td>{Project Location}</td>';
INFOWINDOW_HTML +=   '<td rowspan="8" valign="bottom" align="right"><img src="' +defaultDir+ 'projectpics/{Project Picture}"><br />';
INFOWINDOW_HTML +=   '<span class="caption">{Picture Caption}</span></td></tr>\n';
INFOWINDOW_HTML += '<tr><th>District</th><td>{District}</td></tr>\n';
INFOWINDOW_HTML += '<tr><th>Sponsor</th><td>{Sponsor}</td></tr>\n';
INFOWINDOW_HTML += '<tr><th>Funding Source(s)</th><td>{Funding Source(s)}</td></tr>\n';
INFOWINDOW_HTML += '<tr><th>Total Project Cost Estimate</th><td>{Total Project Cost Estimate}</td></tr>\n';
INFOWINDOW_HTML += '<tr><th>Current Phase</th><td>{Current Phase}</td></tr>\n';
INFOWINDOW_HTML += '<tr><th>Phase Completion Expected</th><td>{Phase Completion Expected}</td></tr>\n';
INFOWINDOW_HTML += '<tr><th>Project Completion Expected</th><td>{Project Completion Expected}</td></tr>\n';
INFOWINDOW_HTML += '</table>\n';
INFOWINDOW_HTML += "</div>";
 
var MapsLib = MapsLib || {};
var MapsLib = {
  
  //Setup section - put your Fusion Table details here
  //Using the v1 Fusion Tables API. See https://developers.google.com/fusiontables/docs/v1/migration_guide for more info
  
  //the encrypted Table ID of your Fusion Table (found under File => About)
  //NOTE: numeric IDs will be depricated soon
  fusionTableId:      "18tUOxF3J_-eXe2Z6F1VQh0emIusJKYgKhtKankc",
  fusionTableId_district: "195G1SlISdfHwHG8PazCkoZA9JVQaeTtqeOcehs0",
  
  //*New Fusion Tables Requirement* API key. found at https://code.google.com/apis/console/      
  googleApiKey:       "AIzaSyDSscDrdYK3lENjefyjoBof_JjXY5LJLRo",        
  
  locationColumn:     "Geometry",     //name of the location column in your Fusion Table
  map_centroid:       new google.maps.LatLng(37.7750, -122.4183), //center that your map defaults to
  locationScope:      "San+Francisco",//geographical area appended to all address searches
  recordName:         "result",       //for showing number of results
  recordNamePlural:   "results", 
  
  searchRadius:       805,            //in meters ~ 1/2 mile
  defaultZoom:        12,             //zoom level when map is loaded (bigger is more zoomed in)
  currentPinpoint: 		null,
  marker: 						null,						// for currently clicked item
  
  // columns for display and download
  columnNames:       ['Project Name','Project Type','Description','Project Location','District',
                      'Sponsor','Funding Source(s)',
                      'Total Project Cost Estimate','Current Phase',
                      'Phase Completion Expected', 'Project Completion Expected', 'Project Details Page',
                      'Project Picture', 'Picture Caption'],
                      
  
  initialize: function() {
    if (gapi.client.fusiontables == null) {
  	  gapi.client.setApiKey(MapsLib.googleApiKey);
      gapi.client.load('fusiontables', 'v1', MapsLib.fusiontablesLoaded);

    }
    
    geocoder = new google.maps.Geocoder();
    var myOptions = {
      zoom: MapsLib.defaultZoom,
      center: MapsLib.map_centroid,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    };
    MapsLib.map = new google.maps.Map($("#mapCanvas")[0],myOptions);
    
    // we will render our own info box to have more control 
    // for popups and also to highlight the selected item
    MapsLib.infoBox = new InfoBox({
	    alignBottom:true,
    	content:"fuzzyman",
    	disableAutoPan:false,
    	infoBoxClearance:10,
    	maxWidth:0,
    	pixelOffset:new google.maps.Size(-307,-74),
    	zIndex:null,
			boxStyle: { 
				// background:"white",
        opacity: 1.0,
        width: "688px",
      },
			closeBoxMargin:"10px 10px 2px 2px",
			closeBoxURL:"http://www.google.com/intl/en_us/mapfiles/close.gif",
      infoBoxClearance: new google.maps.Size(1, 1),
      isHidden: false,
      pane: "floatPane",
      enableEventPropagation: false
    });
    google.maps.event.addDomListener(MapsLib.infoBox, 'closeclick', MapsLib.infoBoxCloseClick);
    
    MapsLib.searchrecords1 = null;
    MapsLib.searchrecords2 = null;
    MapsLib.searchrecords3 = null;
    
    //reset filters
    if ($.address != null) {
      $("#txtSearchAddress").val(MapsLib.convertToPlainString($.address.parameter('address')));
      var loadRadius = MapsLib.convertToPlainString($.address.parameter('radius'));
    }
    if (loadRadius != "") $("#ddlRadius").val(loadRadius);
    else $("#ddlRadius").val(MapsLib.searchRadius);
    $("#district").prop("selectedIndex", 0);
    $("#project-type").prop("selectedIndex", 0);
    $("#project-sponsor").prop("selectedIndex", 0);
    $("#ddlRadius").prop("selectedIndex", 1);
    $(":checkbox").prop("checked", true);
		$("#slider").slider( "option", "value", 100 );
		$("#txtSearchAddress").val('');
		
		MapsLib.slide(null, null);
     
    //run the default search
    MapsLib.doSearch();
  },
  
  doSearch: function(location) {
    MapsLib.clearSearch();

    MapsLib.whereClause = ''; // MapsLib.locationColumn + " not equal to ''";
    
    //-----filter by district-------    
    var district = $("#district").val();
		if (district != "All") {
		  if (MapsLib.whereClause.length > 0) MapsLib.whereClause += " AND "; 
		  MapsLib.whereClause += "District"+district+"=1";
		}
    //-------end of filter by district code--------
		
		//-----filter by funding source-------
    //best way to filter results by a type is to create a 'type' column and assign each row a number (strings work as well, but numbers are faster). then we can use the 'IN' operator and return all that are selected
    if (!($("#FSPropK").is(':checked')) ||
        !($("#FSTFCA").is(':checked')) ||
        !($("#FSRegStFed").is(':checked'))) {
         
      if (MapsLib.whereClause.length > 0) MapsLib.whereClause += " AND ";
      MapsLib.whereClause += "'Funding Source Code' IN (0,";
      if ( $("#FSPropK").is(':checked')) 		MapsLib.whereClause += "4,5,6,7,";  // binary: 4-bit is on
      if ( $("#FSTFCA").is(':checked')) 		MapsLib.whereClause += "2,3,6,7,";  // binary: 2-bit is on
      if ( $("#FSRegStFed").is(':checked')) MapsLib.whereClause += "1,3,5,7,";  // binary: 1-bit is on
      // trim comma
      MapsLib.whereClause = MapsLib.whereClause.substr(0,MapsLib.whereClause.length-1);
      // close paren
      MapsLib.whereClause += ")";
    }
    
		//-----end of filter by funding source-------
		
		//-----filter by project type-------
    var ptype = $("#project-type").val();
		if (ptype != "All") {
      if (MapsLib.whereClause.length > 0) MapsLib.whereClause += " AND "; 
		  MapsLib.whereClause += "'Project Type'='"+ptype + "'";
		}
    //-----end of filter by project type-------
    
		//-----filter by project sponsor-------    
    var psponsor = $("#project-sponsor").val();
    if (psponsor != "All") {
      if (MapsLib.whereClause.length > 0) MapsLib.whereClause += " AND "; 
    	MapsLib.whereClause += "'Sponsor'='" + psponsor + "'";
    }
    //-----end of filter by project sponsor-------    
    

		//-----filter by completion date-------
		if ((MapsLib.slideDate != null) && (MapsLib.slideDate.getTime() != MapsLib.maxDate.getTime())) {
        if (MapsLib.whereClause.length > 0) MapsLib.whereClause += " AND "; 
  			MapsLib.whereClause += "'Project Completion Expected' <= '" + 
				MapsLib.slideDate.getFullYear() + "." + (MapsLib.slideDate.getMonth()+1) + "." + MapsLib.slideDate.getDate() + "'";
		}
    //-----end of filter by completion date-------		
    MapsLib.address = $("#txtSearchAddress").val();

    console.log("address = " + MapsLib.address);        
    if (MapsLib.address != "") {
      if (MapsLib.address.toLowerCase().indexOf(MapsLib.locationScope) == -1)
        MapsLib.address = MapsLib.address + " " + MapsLib.locationScope;
  
      $("div#wait").show();
      geocoder.geocode( { 'address': MapsLib.address}, MapsLib.geocodeResults);
    }
    else { //search without geocoding callback
      MapsLib.submitSearch(MapsLib.whereClause, MapsLib.map);
    }
  },
  
  geocodeResults: function(results, status) {
    console.log("geocodeResults! status="+status);
    $("div#wait").hide();
    
    MapsLib.searchRadius = $("#ddlRadius").val();
    
    if (status == google.maps.GeocoderStatus.OK) {
      MapsLib.currentPinpoint = results[0].geometry.location;
          
      $.address.parameter('address', encodeURIComponent(MapsLib.address));
      $.address.parameter('radius', encodeURIComponent(MapsLib.searchRadius));
      MapsLib.map.setCenter(MapsLib.currentPinpoint);
      MapsLib.map.setZoom(14);
          
      MapsLib.addrMarker = new google.maps.Marker({
        position: MapsLib.currentPinpoint, 
        map: MapsLib.map, 
        animation: google.maps.Animation.DROP,
        title:MapsLib.address
      });
          
      if (MapsLib.whereClause.length > 0) MapsLib.whereClause += " AND "; 
          
      MapsLib.whereClause += "ST_INTERSECTS(" + MapsLib.locationColumn + ", CIRCLE(LATLNG" + MapsLib.currentPinpoint.toString() + "," + MapsLib.searchRadius + "))";
          
      MapsLib.drawSearchRadiusCircle(MapsLib.currentPinpoint);
      MapsLib.submitSearch(MapsLib.whereClause, MapsLib.map, MapsLib.currentPinpoint);
    } 
    else {
      console.log("We could not find your address: " + status);
      alert("We could not find your address: " + status);
    }
    
  },
  
  submitSearch: function(whereClause, map, location) {
		// keep the whereClause for the displayCount
		MapsLib.whereClause = whereClause;
    console.log("whereClause = " + whereClause);
    
    // make the download link
    var download_query = "SELECT '" + MapsLib.columnNames.join("','") + "' from " + MapsLib.fusionTableId;
    if (whereClause.length > 0) {
      download_query += " WHERE " + whereClause;
    }
    var download_link = "https://www.googleapis.com/fusiontables/v1/query?sql=" + encodeURIComponent(download_query);
    download_link += "&key=" + MapsLib.googleApiKey;
    download_link += "&alt=csv";
    $("a#download").attr('href', download_link);
    console.log(download_link);
    

    // get using all filters -- polygons on the bottom
    var polygon_where = whereClause + ((whereClause.length > 0) ? " AND " : "") + MapsLib.locationColumn + " CONTAINS 'Polygon'";
    console.log("polygon_where = " + polygon_where);
    MapsLib.searchrecords1 = new google.maps.FusionTablesLayer({
      query: {
        from:   MapsLib.fusionTableId,
        select: MapsLib.locationColumn,
        where:  polygon_where
      },
      options: {
      	suppressInfoWindows: true
      },
    });
    MapsLib.searchrecords1.setMap(map);
    google.maps.event.addListener(MapsLib.searchrecords1, 'click', MapsLib.layer_clicked);
    
    // then Lines
    var line_where = whereClause + ((whereClause.length > 0) ? " AND " : "") + MapsLib.locationColumn + " CONTAINS 'Line'";
    console.log("line_where = " + line_where);
    MapsLib.searchrecords2 = new google.maps.FusionTablesLayer({
      query: {
        from:   MapsLib.fusionTableId,
        select: MapsLib.locationColumn,
        where:  line_where
      },
      options: {
      	suppressInfoWindows: true
      },
    });
    MapsLib.searchrecords2.setMap(map);
    google.maps.event.addListener(MapsLib.searchrecords2, 'click', MapsLib.layer_clicked);

    // then Points
    var points_where = whereClause + ((whereClause.length > 0) ? " AND " : "") + MapsLib.locationColumn + " CONTAINS 'Point'";
    console.log("points_where = " + points_where);
    MapsLib.searchrecords3 = new google.maps.FusionTablesLayer({
      query: {
        from:   MapsLib.fusionTableId,
        select: MapsLib.locationColumn,
        where:  points_where
      },
      options: {
        suppressInfoWindows: true
      },
    });
    MapsLib.searchrecords3.setMap(map);
    google.maps.event.addListener(MapsLib.searchrecords3, 'click', MapsLib.layer_clicked);
    
    
    // district boundary if a district is used for filtering
		var district = $("#district").val();   
		if (district != "All") {
		
			if (MapsLib.districtLayer) {
				MapsLib.districtLayer.setMap(null);
				MapsLib.districtLayer = null;
			}
		
			MapsLib.districtLayer = new google.maps.FusionTablesLayer({
				query: {
					from:	MapsLib.fusionTableId_district,
					select: "geometry",
					where: "name = " + district
				}
			});
			MapsLib.districtLayer.setMap(map);		
		}
		else {
			if (MapsLib.districtLayer) {
				MapsLib.districtLayer.setMap(null);
				MapsLib.districtLayer = null;
			}
		}
        
    MapsLib.displayCount();
  },
  
  clearSearch: function() {
    if (MapsLib.searchrecords1 != null)
      MapsLib.searchrecords1.setMap(null);
    if (MapsLib.searchrecords2 != null)
      MapsLib.searchrecords2.setMap(null);
    if (MapsLib.searchrecords3 != null)
      MapsLib.searchrecords3.setMap(null);
            
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
    $( "#resultCount" ).html(MapsLib.addCommas(numRows) + " " + name + " found");
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
    // load the citywide projects
    MapsLib.queryCitywideTypes();
  },

  queryLegend: function() {
    var query = "select 'Project Type',Shape,'Icon_Name' from "+MapsLib.fusionTableId+" ORDER BY 'Project Type'";
    var request = gapi.client.fusiontables.query.sqlGet({'sql':query});
    request.execute(MapsLib.displayLegend);
  },
  
  redisplayLegend: function() {
  	if (MapsLib.legendJson) {
  		MapsLib.displayLegend(MapsLib.legendJson);
  	}
  },
  
  displayLegend: function(json) {
		MapsLib.legendJson = json;    
    // this is adapted from 
    // http://gmaps-samples.googlecode.com/svn/trunk/fusiontables/dynamic_styling_template.html
    var legendDiv = document.createElement('div');
    var legend = new Legend(legendDiv, json);
    // console.log(legendDiv.innerHTML);
    legendDiv.index = 1;
    //MapsLib.map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].pop();
    MapsLib.map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(legendDiv);
  },
  
  queryCitywideTypes: function() {
    var query = "select 'Project Type' from " + MapsLib.fusionTableId + " WHERE District Like 'City%' ORDER BY 'Project Type'";
    var request = gapi.client.fusiontables.query.sqlGet({'sql':query});
    request.execute(MapsLib.displayCitywideTypes);
  },
  
  displayCitywideTypes: function(json) {
    var li_list = "";
    prev_type = '';
    for (rownum = 0; rownum < json["rows"].length; rownum++) {
      proj_type = json["rows"][rownum][0];
      proj_type_id = proj_type.toLowerCase().replace(/ /g,"_");
      
      if (proj_type != prev_type) { 
        
         li_list +=  '<li id="' + proj_type_id + '"><a onclick="MapsLib.queryCitywide(\'' + proj_type + '\'); return true;" ';
         li_list += 'href="javascript:MapsLib.queryCitywide(\'' + proj_type + '\');">';
         li_list += proj_type + '</a></li>\n';
      }
      prev_type = json["rows"][rownum][0];
    }
    $("#citywide-types").html(li_list);
  },
  
  // query the citywide project (those that have Geometry) for display
  queryCitywide: function(project_type) {
    // unset the previous li
    $("ul#citywide-types li").removeClass("selected");
  
    // set the li as selected
    project_type_id = project_type.toLowerCase().replace(/ /g,"_");
    $("li#"+project_type_id).addClass("selected");
      
  	var query = "select '" + MapsLib.columnNames.join("','") + "' from " + MapsLib.fusionTableId;
  	query += " WHERE District LIKE 'City%'";
  	query += " AND 'Project Type'='" + project_type + "'";
  	query += " ORDER BY 'Project Name'";
  	var request = gapi.client.fusiontables.query.sqlGet({'sql':query});
  	request.execute(MapsLib.displayCitywide);
  }, 
  
  // create the citywide project list html
  displayCitywide: function(json) {
  	// console.log("displayCitywide");
  	// console.log(json);
  	var li_list = "";
  	var link_col = MapsLib.columnNames.length-3;
  	var pic_col  = MapsLib.columnNames.length-2;
  	var pic_cap  = MapsLib.columnNames.length-1;
  	
  	
	  for(rownum = 0; rownum < json["rows"].length; rownum++) {
	  	var divHtml = '<div id="citywide-' + rownum + '" class="googft-info-window citywide-info-window" style="display:none">'
	  	divHtml += '<div class="citywide-info-x" onclick="HideContent(\'citywide-'+rownum+'\'); return true;"><img src="http://www.google.com/intl/en_us/mapfiles/close.gif"></div>';
	  	divHtml += '<table class="map_info">';

      var post_desc= false;
      var do_pic   = false;
	  	for (var colnum = 0; colnum < MapsLib.columnNames.length-3; colnum++) {

				// skip project location
				if (MapsLib.columnNames[colnum] == 'Project Location') { continue; }
								
	  	  divHtml += '<tr><th>' + MapsLib.columnNames[colnum] + '</th>';
        if (post_desc==true) {
          divHtml += '<td>';
        } else {
          divHtml += '<td colspan="2">';
        }

	  	  // link to the project details
	  	  if (colnum==0 && json["rows"][rownum][link_col].length > 0) {
	  	  	divHtml += '<a target="_blank" href="' + json["rows"][rownum][link_col] + '">';
		  	}
		  	
		  	// the currency amounts need to be formatted
		  	if (MapsLib.columnNames[colnum] == 'Total Project Cost Estimate') {
		  	  divHtml += "$" + MapsLib.addCommas(json["rows"][rownum][colnum]);
		  	} else {
  	  	  divHtml += json["rows"][rownum][colnum];
  	  	}
  	  	
	  	  if (colnum==0 && json["rows"][rownum][link_col].length > 0) {
					divHtml += '</a>';
				}
				
				if (do_pic) {
				  var rowspan=MapsLib.columnNames.length-colnum-3;
				  divHtml += '</td><td valign="bottom" align="right" rowspan="' + rowspan.toString() + '">';
          if (json["rows"][rownum][pic_col].length > 0) {
            divHtml += '<img src="' +defaultDir+ 'projectpics/' + json["rows"][rownum][pic_col] +'"><br />';
            divHtml += '<span class="caption">' + json["rows"][rownum][pic_cap]+'</span>';
          }
          divHtml += '</td>';
				  do_pic = false; // only do this once
				}
				  
	  	  divHtml += '</td></tr>';
	  	  if (MapsLib.columnNames[colnum]=='Description') { post_desc=true; do_pic=true; }
	  	}
	  	divHtml += '</table>';

	  	divHtml += '</div>';
	  	li_list += '<li><a onclick="ShowContent(\'citywide-'+rownum+'\'); return true;" ';
	  	li_list +=        'href="javascript:ShowContent(\'citywide-'+rownum+'\');">'+json["rows"][rownum][0]+'</a></li>' + divHtml + '\n';
		}
		$('#citywide-list').html(li_list);
  },

  // for formatting numbers
  addCommas: function(nStr)
  {
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
  
  querySliderDates: function() {
    var query = "select MINIMUM('Project Completion Expected'),MAXIMUM('Project Completion Expected') from "+MapsLib.fusionTableId;
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
	},
	
	show_colorbox: function(url) {
	  // console.log("show_colorbox; url="+url);
	  jQuery().colorbox({width:"90%", height:"90%", iframe:true, href:url});
	},
	
	layer_clicked: function(event) {
		console.log(event);
		
		var text = '<div class="infoBoxRelative"><div class="infoTable">'
		// unfortunately this gets stale!  so we'll just do it ourselves...
    // text += event.infoWindowHtml;
    text += INFOWINDOW_HTML;
    for (var colnum = 0; colnum < MapsLib.columnNames.length; colnum++) {
      text = text.replace("{"+MapsLib.columnNames[colnum] + "}", event.row[MapsLib.columnNames[colnum]]['value']);
    }
    if (event.row['Project Picture']['value'].length == 0) {
      text = text.replace("<div class='projpic'>", "<div class='projpic' style='visibility:hidden'>");
    }
		text += '</div><div class="infoPointer"><img src="' +defaultDir+ 'styles/pointer.png"></div></div>';
		
		
		// ALTERNATIVE TO NEW TAB -- COLORBOX -- TEST
		/*
		if (event.row['Project Name']['value'] == "Dewey Traffic Calming Project") {
  		text = text.replace(new RegExp('target="_blank" href="([^"]*)"'), 
	   	  'target="_blank" class="iframe" onClick=\'MapsLib.show_colorbox("$1");\' target="#"');
	  }*/
		
		MapsLib.infoBox.setContent(text);
		MapsLib.infoBox.setPosition(event.latLng);
		MapsLib.infoBox.open(MapsLib.map);
		
		if (MapsLib.marker) {
			MapsLib.marker.setMap(null);
			MapsLib.marker = null;
		}
		if (MapsLib.highlightRecord) {
			MapsLib.highlightRecord.setMap(null);
			MapsLib.highlightRecord = null;
		}
		
		// add a special marker for this
		if (event.row['Shape']['value'] == "Point") {
			var markerImage = new google.maps.MarkerImage(
        defaultDir+ "styles/" + event.row['Icon_Name']['value']+"_highlight.png",
				new google.maps.Size(13,13),
			 	new google.maps.Point(0,0),
			 	new google.maps.Point(7,7)
			);
				
				
			MapsLib.marker = new google.maps.Marker({
				map:MapsLib.map,
				position:event.latLng,
				icon:markerImage,
			});
		} else {
			MapsLib.highlightRecord = new google.maps.FusionTablesLayer({
      	query: {
        	from:   MapsLib.fusionTableId,
        	select: MapsLib.locationColumn,
        	where:  "'Project Name'='" + event.row['Project Name']['value'] + "'"
      	},
      	options: {suppressInfoWindows: true},
	      styles: [{ polygonOptions: {strokeColor:"#fff460", strokeWeight:"2", fillOpacity:1.0},
	      					 polylineOptions: {strokeWeight:6, strokeOpacity:1.0}
	      				}]
 	    });
	    MapsLib.highlightRecord.setMap(MapsLib.map); 
    }
    
	},
	
	infoBoxCloseClick : function() {
		// console.log("MapsLib.infoBoxContentChanged");
		// console.log($("div.infoBox div.googft-info-window tr:first"));
		if (MapsLib.marker) {
			MapsLib.marker.setMap(null);
			MapsLib.marker = null;
		}
		if (MapsLib.highlightRecord) {
			MapsLib.highlightRecord.setMap(null);
			MapsLib.highlightRecord = null;
		}		
	}
	
}

// Generate the content for the legend
function Legend(controlDiv, json) {
  // console.log("Legend!");
  controlDiv.style.padding = '10px';
  var controlUI = document.createElement('div');
  controlUI.title = 'Legend';
  controlUI.id = 'legend';
  controlDiv.appendChild(controlUI);
  var controlText = document.createElement('div');
	controlText.id = "legendtext";

  controlText.innerHTML = legendContent(json);
  controlUI.appendChild(controlText);
}

function legendContent(json) {
  // Generate the content for the legend using colors from object
  var controlTextList = new Array();
  controlTextList.push('<p style="margin-top:3px">Legend</p>');
  controlTextList.push('<table id="legend">\n');
  // console.log(json);
  
  var done_set = {} // project types that are done
  for(rownum in json["rows"]) {
    // each row = Project Type, Shape, icon name

		// ignore empties
    if (json["rows"][rownum][2] == '') { continue; }

		// ignore if we've done it already
		if (done_set.hasOwnProperty(json["rows"][rownum][0])) { continue; }
		 
    // console.log(json["rows"][rownum]);
    var shape = json["rows"][rownum][1];
    var icon  = json["rows"][rownum][2];
    var color = json["rows"][rownum][2];
    
    if (color[0] != "#") { continue; }
    
    // icon images are here: https://groups.google.com/forum/?fromgroups=#!starred/fusion-tables-users-group/Zwoq9xivyXs
    controlTextList.push('<tr><td>');
    // always do polylines
	  controlTextList.push('<div id="lineicon" style="background-color:'+color+'"></div>');
    controlTextList.push('</td>');
    
    controlTextList.push('<td id="legendlabel">' + json["rows"][rownum][0] + '</td></tr>');
    
    done_set[json["rows"][rownum][0]] = 1;
  }
  controlTextList.push('</table>\n');

  return controlTextList.join('');
}

function HideContent(id) {
	$("div#"+id).fadeOut();
}

function ShowContent(id) {
  // hide the other one(s) if necessary
  $("ul#citywide-list div.googft-info-window").each(function (index) {
    if (this.id != id) { HideContent(this.id); }
  });
  
	$("div#"+id).fadeIn();
}