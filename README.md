MyStreetSF
==========

Html and javascript for MyStreetSF, which uses Google Maps and Google Fusion Tables to show all projects currently underway that are funded by, or prioritized for funding by the SFCTA, as well as those for which the SFCTA provides some level of oversight, in our role as Congestion Management Agency for San Francisco.


Guide to files
--------------

 * The *source* is the most important.  Most of these files, I pulled from somewhere for styling and such.  The important code is in *source/maps_lib.js*.  This file basically handles changes to the web page widgets and constructs fusion table queries to gather the correct data to display on the google map.
 * The *index.html* is to help test the source on your local machine.  I had my apache installation serve the directory.  The drupal mystreetsf page is a version of this but I sync changes manually since they're too different.
 * The *projectpics* directory is not directly used.  For a while, when my machine served as the test map, this was used but later we started uploading directly to the webserver, so this directory is behind.


