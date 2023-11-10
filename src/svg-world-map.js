/**
 * SVG World Map JS
 * v0.2.4
 * 
 * Description: A Javascript library to easily integrate one or more SVG world map(s) with all nations (countries) and political subdivisions (countries, provinces, states). 
 * Author: Raphael Lepuschitz <raphael.lepuschitz@gmail.com>
 * Copyright: Raphael Lepuschitz
 * URL: https://github.com/raphaellepuschitz/SVG-World-Map
 * License: MIT
 **/

var svgWorldMap = (function() { 

    // Global variables
    var svg;
    var baseNode;
    var basePoint;
    var infoBox;
    var isMobile = false;
    var smallScreen = false;
    var svgMap = {};
    var countries = {};
    var countryData = {};
    var countryGroups = {};
    var countryLabels = {};
    var shapes = {};
    var tableData = {};
    var selectedCountry;
    var svgNS = "http://www.w3.org/2000/svg";
    //var dragMap = false; // TODO: Check, doesn't work smooth 

    // Default options
    var options = {
        // Base path 
        libPath: '../src/', // Point to library folder, e.g. (http[s]:)//myserver.com/map/src/
        // Basic options
        bigMap: true, // Set to 'false' to load small map without provinces
        showOcean: true, // Show or hide ocean layer
        showAntarctica: true, // Show or hide antarctic layer
        showLabels: true, // Show country labels
        showMicroLabels: false, // Show microstate labels
        showMicroStates: true, // Show microstates on map
        showInfoBox: false, // Show info box
        backgroundImage: '', // Background image path
        // Color options
        oceanColor: '#D8EBFF', 
        worldColor: '#FFFFFF', 
        labelFill: { out: '#666666',  over: '#333333',  click: '#000000' }, 
        //countryFill: { out: '#B9B9B9',  over: '#CCCCCC',  click: '#666666' }, // TODO: Currently this makes no sense for main country groups, until all country borders are existing in the SVG (a lot are missing, e.g. Japan, Greenland, Antarctica)
        countryStroke: { out: '#FFFFFF',  over: '#FFFFFF',  click: '#333333' }, 
        countryStrokeWidth: { out: '0.5',  over: '1',  click: '1' }, 
        provinceFill: { out: '#B9B9B9',  over: '#FFFFFF',  click: '#666666' }, 
        provinceStroke: { out: '#FFFFFF',  over: '#FFFFFF',  click: '#666666' }, 
        provinceStrokeWidth: { out: '0.1',  over: '0.5',  click: '0.5' }, 
        // Group options
        groupCountries: true, // Enable or disable country grouping
        groupBy: [ "region" ], // Sort countryData by this value(s) and return to countryGroups
        // Coordinates
        trackCoords: false, // Track map coords, default 'false' due to performance
        // Callback functions from the map to the outside, can have custom names
        mapOut: "mapOut", 
        mapOver: "mapOver", 
        mapClick: "mapClick", 
        mapCoords: "mapCoords", 
        mapDate: "mapDate", // (Custom) callback function for time control date return
        mapTable: "mapTable", // (Custom) callback function for HTML data parsing
        // Time controls
        timeControls: false, // Set to 'true' for time controls
        timePause: true, // Set to 'false' for time animation autostart
        timeLoop: false //  Set to 'true' for time animation loop
    };

    // Main function: SVG map init call, options handling, return the map object
    async function svgWorldMap(initOptions, initCountryData, initTimeData) {
        let promise1 = new Promise(resolve1 => {
            // Check size, viewport and mobile
            checkSize();
            checkMobile();
            // Overwrite default options with initOptions
            for (var option in initOptions) {
                if (initOptions.hasOwnProperty(option)) { 
                    options[option] = initOptions[option];
                }
            }
            // Overwrite countryData with initCountryData
            if (initCountryData != undefined && initCountryData != false) { 
                countryData = initCountryData;
            }
            // Asynchronous SVG map load
            // Inject HTML with SVG map
            initMap();
            // Wait for asynchronous svg load
            svg.addEventListener("load", async () => {
                let promise2 = new Promise(resolve2 => {
                    // Set SVG base node
                    baseNode = svg.getSVGDocument().children[0]; 
                    // Startup SVG path traversing, then country sorting, followed by click handlers, etc.
                    initMapCountries();
                    // Return svgMap object after everything is ready and bind calling home functions
                    svgMap = { 
                        'worldMap': svg, 
                        'countries': countries, 
                        'countryData': countryData, 
                        'countryGroups': countryGroups, 
                        'countryLabels': countryLabels, 
                        'shapes': shapes, 
                        // Calling home functions from outside into the map 
                        // TODO: maybe use 'this["countryXYZ"]' insted of 'window["countryXYZ"]' for several maps? -> Leads to too much recursion...
                        'out': function(id) { window["countryOut"].call(null, id); }, 
                        'over': function(id) { window["countryOver"].call(null, id); }, 
                        'click': function(id) { window["countryClick"].call(null, id); }, 
                        'update': function(data) { window["updateMapData"].call(null, data); }, 
                        'reset': function(data) { window["resetMap"].call(null, data); }, 
                        'labels': function(data) { window["toggleMapLabels"].call(null, data); }, 
                        'download': function(data) { window["downloadMap"].call(null, data); }, 
                        'coords': function(data) { window["getCoords"].call(null, data); }, 
                        'shape': function(data) { window["drawShape"].call(null, data); }, 
                        'date': function(data) { window["timeControlsDate"].call(null, data); }, 
                        'table': function(data) { window["parseHTMLTable"].call(null, data); }, 
                    };
                    // Load time controls
                    if (options.timeControls == true) {
                        svgWorldMapTimeControls(options.timePause, options.timeLoop, initTimeData);
                    }
                    // Add info box
                    if (options.showInfoBox == true) {
                        initInfoBox();
                    }
                    // Init coordinates
                    if (options.trackCoords == true) {
                        initCoords();
                    }
                    resolve2(svgMap);
                });
                let result2 = await promise2;
                resolve1(result2);
            }, false);
        });
        // Wait for loaded map
        let result1 = await promise1;
        svgMap = result1;
        // Return SVG World Map object
        return svgMap;
    }

    // Init SVG map
    function initMap() {
        // Avoid double loading
        if (document.getElementById('svg-world-map-container') == null) {
            // Add SVG container HTML
            var container = document.createElement("div");
            container.setAttribute("id", "svg-world-map-container");
            document.body.prepend(container);
            // Add SVG HTML, 'svg' is global
            svg = document.createElement("object");
            svg.setAttribute("id", "svg-world-map");
            svg.setAttribute("type", "image/svg+xml");
            // Load small map with states only
            if (smallScreen != false || options.bigMap == false) { // isMobile == true
                svg.setAttribute("data", options.libPath + "world-states.svg");
            // Load big map with provinces
            } else {
                svg.setAttribute("data", options.libPath + "world-states-provinces.svg");
            }
            container.appendChild(svg);
            // Add container and SVG CSS
            // TODO: Make optional? Not needed for SVG World Map, but for SVG pan zoom etc.
            var style = document.createElement('style');
            style.innerHTML = `#svg-world-map-container, #svg-world-map { width: 100%; height: 100%; }`;
            document.head.appendChild(style);
        }
    }

    // Init countries on SVG map
    function initMapCountries() {
        // Iterate through child nodes and add them to countries object
        baseNode.childNodes.forEach(function(node) {
            // Skip unclear disputed territories and also metadata, defs etc. - we want a clean node list
            if (node.id != undefined && node.id.substr(0, 1) != '_' && (node.tagName == 'g' || node.tagName == 'path' || node.tagName == 'rect')) { 
                countries[node.id] = node;
            }
        });
        // World & ocean settings
        countries['World'].style.fill = options.worldColor; 
        countries['Ocean'].style.fill = options.oceanColor; 
        if (options.showOcean == false) {
            countries['Ocean'].style.fill = 'none'; 
            countries['Ocean'].style.stroke = 'none'; 
        }
        // Add map backgound image, if set
        if (options.backgroundImage != '') {
            var background = document.createElementNS(svgNS, "image");
            background.setAttribute("id", "Background");
            background.setAttribute("overflow", "visible");
            background.setAttribute("width", "1000");
            background.setAttribute("height", "507");
            //background.setAttribute("width", "2000");
            //background.setAttribute("height", "1000");
            background.setAttribute("href", options.backgroundImage);
            //var zw = baseNode.getElementById("ZW");
            //baseNode.insertBefore(background, zw);
            var world = baseNode.getElementById("World");
            baseNode.insertBefore(background, world);
            countries['World'].style.fill = 'rgba(255, 255, 255, 0)'; 
            countries['Ocean'].style.fill = 'rgba(255, 255, 255, 0)'; 
        }
        // Get microstates from labels and remove from countries
        sortLabels();
        //delete countries['Ocean']; // (Delete ocean from countries object) Keep it currently
        // Delete Antarctica from countries and labels, if set in options
        if (options.showAntarctica == false) {
            baseNode.removeChild(baseNode.getElementById("AQ"));
            delete countries['AQ']; 
            baseNode.getElementById("labels").removeChild(baseNode.getElementById("AQ-label"));
            delete countryLabels['AQ']; 
        }
        // Show labels on start, if it is set
        if (options.showLabels == true) {
            toggleMapLabels('all');
        }
        delete countries['labels']; // Delete labels from countries object, not from map
        // Pre-sort provinces
        sortProvinces();
        // Sort countries alphabetically
        countries = sortObject(countries);
        // Init country groups
        if (options.groupCountries == true) {
            buildCountryGroups();
        }
        // Add group for shapes
        var shapeGroup = document.createElementNS(svgNS, "g");
        shapeGroup.setAttribute("id", "shapes");
        baseNode.appendChild(shapeGroup);
        shapes = baseNode.getElementById("shapes");
    }

    // Pre-sort provinces and subprovinces in countries for faster access and node cleanup
    // TODO: Cleanup, optimize?
    function sortProvinces() {
        for (var country in countries) {
            // Add all details from countryData to country
            if (countryData[countries[country].id] != undefined) {
                var currentCountryData = countryData[countries[country].id];
                for (var key in currentCountryData) {
                    countries[country][key] = currentCountryData[key]; 
                }
            }
            countries[country].country = countries[country]; // Reference to self for hierarchy compatibility - it's a little crazy, i know ;-) 
            var provinces = []; // Empty array for all provinces
            // Ungrouped provinces are 1 level deep
            countries[country].childNodes.forEach(function(child) { 
                // Add parent country and province for hierarchy compatibility
                child.country = countries[country]; 
                child.province = child; // Reference to self for hierarchy compatibility
                // 'id.toLowerCase()' is the nation (border) element, so this is the main country (nation)
                if (child.id == countries[country].id.toLowerCase()) { 
                    countries[country].border = child; // Add border to nation
                    if (child.tagName != 'g') { // Groups are colored below
                        pathSetAttributes(child, 'out'); // Set border attributes
                        //provinces.push(child); // Don't push the nation (border) element, it's not needed in provinces
                    } else {
                        child.childNodes.forEach(function(grandchild) { 
                            if (grandchild.nodeType != Node.TEXT_NODE) {
                                // Add country and parent province for hierarchy compatibility
                                grandchild.country = countries[country];
                                grandchild.province = child; 
                                pathSetAttributes(grandchild, 'out');
                            }
                        });
                    }
                // Skip elements like circles (microstates)
                } else if (child.tagName == 'path' && child.tagName != 'circle' && child.id != countries[country].id.toLowerCase()) { 
                    pathSetAttributes(child, 'out');
                    provinces.push(child);
                // Grouped provinces are 2 levels deep (We have to go deeper!)
                } else if (child.tagName == 'g') {
                    var subprovinces = []; // Empty array for all sub-provinces
                    child.childNodes.forEach(function(grandchild) { 
                        // Add country and parent province for hierarchy compatibility
                        grandchild.country = countries[country];
                        grandchild.province = child; 
                        if (grandchild.tagName == 'path') { 
                            if (grandchild.getAttribute('fill') != 'none') { // Don't push border grandchilds
                            //provinces.push(grandchild);
                            subprovinces.push(grandchild);
                            /*} else {
                                console.log(grandchild); // Only path15677, TODO: Cleanup SVG */
                            }
                            pathSetAttributes(grandchild, 'out');
                        /* } else if (grandchild.nodeType != Node.TEXT_NODE) {
                            console.log(grandchild);  // Only <circle id="tf."> and <circle id="hk_">, TODO: Cleanup SVG  */
                        }
                    }); 
                    child.provinces = subprovinces; // Add subprovinces to province
                    provinces.push(child);
                }
            }); 
            countries[country].provinces = provinces; // Add provinces to country
        }
        initMapControls();
        //countCountries();
    }

    // Get microstates from labels
    function sortLabels() {
        countries['labels'].childNodes.forEach(function(label) { 
            // Skip non-<text> text 
            if (label.tagName == 'text') {
                var countryId = label.id.substr(0, 2);
                countryLabels[countryId] = label; // Add to countryLabels
                // Set custom country name
                if (label.textContent != countryData[countryId].name) {
                    label.textContent = countryData[countryId].name;
                }
                // Set fill and get microstates by font size in SVG
                label.setAttribute('fill', options.labelFill.out);
                if (label.getAttribute('font-size') == 2) { // TODO: Make country sizes var? 
                    label.microstate = true;
                } else {
                    label.microstate = false;
                }
                // Add event listeners
                label.addEventListener("mouseover", function() { countryOver(this.id.substr(0, 2)); updateInfoBox('over', countries[this.id.substr(0, 2)]); });
                label.addEventListener("mouseout", function() { countryOut(this.id.substr(0, 2)); updateInfoBox('out', countries[this.id.substr(0, 2)]); });
                label.addEventListener("mouseup", function() { countryClick(this.id.substr(0, 2)); });
            }
        });
        for (var label in countryLabels) {
            if (countryLabels[label].microstate == true) {
                var microid = countryLabels[label].id.substr(0, 2);
                // Set microstate labels
                if (options.showMicroLabels == false) {
                    countryLabels[label].setAttribute('display', 'none');
                }
                // Set microstates
                if (options.showMicroStates == false) {
                    countries[microid].setAttribute('display', 'none');
                }
            }
        }
    }

    // Set country label color
    function setLabelFill(id, event) {
        if (countryLabels != undefined && countryLabels[id] != undefined) {
            countryLabels[id].setAttribute('fill', options.labelFill[event]); 
        }
    }

    // Set all attributes for a path
    // TODO: Check over, out and selectedCountry logic
    function pathSetAttributes(path, event) {
        if (path != undefined && path.id != 'World' && path.id != 'Ocean') {
            // Hover and click colors and stroke width are defined in options, don't hover selected country
            if (event == 'click' || ((event == 'out' || event == 'over') && path != selectedCountry && path.country != selectedCountry)) {
                // Country border (nation overlay, get's no fill)
                if (path == path.country.border || path.parentNode == path.country.border) {
                    path.setAttribute('stroke', options.countryStroke[event]);
                    path.setAttribute('stroke-width', options.countryStrokeWidth[event]);
                // Other provinces
                } else {
                    // Keep updated color 
                    if (path.updateColor != undefined) {
                        path.setAttribute('fill', path.updateColor);
                    } else {
                        path.setAttribute('fill', options.provinceFill[event]);
                    }
                    path.setAttribute('stroke', options.provinceStroke[event]);
                    path.setAttribute('stroke-width', options.provinceStrokeWidth[event]);
                }
            // Set color to path directly, also to selected country
            } else if (typeof event === "string" && (event.substr(0, 1) == '#' || event.substr(0, 3) == 'rgb')) { // && path != selectedCountry && path.country != selectedCountry
                path.setAttribute('fill', event);
            }
        }
    }
    
    // Init info box
    function initInfoBox() {
        // Add info box HTML to SVG map container
        infoBox = document.createElement("div");
        infoBox.setAttribute("id", "map-infobox");
        document.getElementById('svg-world-map-container').appendChild(infoBox);
        // Add info box CSS
        var style = document.createElement('style');
        style.innerHTML = `
            #map-infobox { position: absolute; top: 0; left: 0; padding: 3px 6px; max-width: 270px; overflow: hidden; font-family: 'Trebuchet MS', Verdana, Arial, sans-serif; font-size: 13px; color: #444444; background-color: rgba(255, 255, 255, .75); border: 1px solid #CDCDCD; border-radius: 5px; }
            #map-infobox .data { margin-top: 5px; }
        `;
        document.head.appendChild(style);
        // Add event listener and set display to none at start
        infoBox.style.display = 'none';
        baseNode.addEventListener("mousemove", function(event) {
            var x = event.clientX;
            var y = event.clientY;
            tooltip.style.top = (y + 20) + 'px'; // ajuste de 20 pixels para a distância vertical
            tooltip.style.left = (x + 20) + 'px'; // ajuste de 20 pixels para a distância horizontal
            if (infoBox.style.display != 'none') {
                infoBox.style.left = (event.clientX - (infoBox.offsetWidth / 2)) + 'px';
                if (event.clientY < (infoBox.offsetHeight + 25)) {
                    infoBox.style.top = (event.clientY + 25) + 'px';
                } else {
                    infoBox.style.top = (event.clientY - infoBox.offsetHeight - 15) + 'px';
                }
            }
        }, false);
    }

    // Update info box
    function updateInfoBox(event, path) {
        // Info box is set in options.showInfoBox, otherwise undefined
        if (infoBox != undefined) {
            if (event == 'over' && path.id != 'World' && path.id != 'Ocean') {
                var infoText = '<b>' + path.country.name + '</b>';
                // Add province info, but not for unnamed paths and borders
                if (path.id.substr(0, 4) != 'path' && path.id.substr(0, 2) != path.country.id.toLowerCase() && path.id.length != 2) {
                    infoText += '<br>' + path.id;
                }
                // Add table data info for country or province
                if (tableData[path.country.id] != undefined || tableData[path.id] != undefined) {
                    infoText += '<div class="data">';
                    if (tableData[path.country.id] != undefined) {
                        var tableInfo = tableData[path.country.id];
                    } else {
                        var tableInfo = tableData[path.id];
                    }
                    for (var details in tableInfo) {
                        infoText += '<b>' + details + '</b>: ' + tableInfo[details] + '<br>';
                    }
                    infoText += '</div>';
                }
                // Basic implementation of time data info for corona map, TODO: refactor
                // Add info for dayData, if it exists
                if (typeof(dayData) !== 'undefined' && dayData[path.country.id] != undefined) {
                    infoText += '<div class="data">';
                    infoText += 'Date: ' + dayData[path.country.id].dates[day] + '<br>';
                    infoText += 'Conf. : <span class="red">' + dayData[path.country.id].confirmed[day] + '</span><br>';
                    infoText += 'Active: <span class="orange">' + dayData[path.country.id].activecases[day] + '</span><br>';
                    infoText += 'Rec. : <span class="green">' + dayData[path.country.id].recovered[day] + '</span><br>';
                    infoText += 'Deaths: <span class="black">' + dayData[path.country.id].deaths[day] + '</span><br>';
                    //infoText += 'New Cases: <span class="black">' + dayData[path.country.id].confirmednew[day] + '</span>';
                    infoText += '</div>';
                }
                infoBox.innerHTML = infoText;
                infoBox.style.display = 'block';
            } else {
                infoBox.style.display = 'none';
            }
        }
    }

    // Init coordiante tracking
    // Robinson projection: Use https://github.com/proj4js/proj4js/releases
    // TODO: Make coords work with svg pan zoom 
    function initCoords() {
        // Add base point and event listener for coords
        basePoint = baseNode.createSVGPoint(); 
        baseNode.addEventListener("mousemove", function(event) { 
            var x = event.clientX;
            var y = event.clientY;
            tooltip.style.top = (y + 20) + 'px'; // ajuste de 20 pixels para a distância vertical
            tooltip.style.left = (x + 20) + 'px'; // ajuste de 20 pixels para a distância horizontal
            basePoint.x = event.clientX;
            basePoint.y = event.clientY;
            // Translate cursor point to svg coordinates
            var svgPoint =  basePoint.matrixTransform(baseNode.getScreenCTM().inverse());
            callBack('coords', svgPoint);
        });
    }

    // Map controls
    function initMapControls() {
        for (var country in countries) {
            countries[country].addEventListener("mouseover", function() { provinceOverOut('over'); });
            countries[country].addEventListener("mouseout", function() { provinceOverOut('out'); });
            countries[country].addEventListener("mouseup", function() { provinceClick(); });
        }
    }

    // Map country hover handling
    function provinceOverOut(overout) {
        var province = event.srcElement; // Get (sub-)country / province / state
        var country = province.country; 
        // Check if (parent) country for path exists
        if (country != undefined) { 
            // Check if country is not selected
            if (province != selectedCountry) { 
                pathSetAttributes(province, overout);
                // Remove highlight from circles for microstates on out
                if (province.tagName == 'circle' && overout == 'out') { 
                    province.removeAttribute('fill');
                    province.removeAttribute('stroke');
                }
            }
        } else {
            //console.log('Country not found for ' + province.id);
        }
        // Update info box and make callback
        updateInfoBox(overout, province);
        callBack(overout, province);
    }
 
    // Map click handling and internal callback routing
    function provinceClick() {
        //if (dragMap == false) { // TODO: Check, doesn't work smooth
            var province = event.srcElement; // Get (sub-)country / province / state
            var selectedOld = selectedCountry;
            // Set new or unset current selectedCountry
            if (selectedCountry == province) {
                selectedCountry = undefined; 
                pathSetAttributes(province, 'out');
            } else {
                var selectedOld = selectedCountry;
                selectedCountry = province; 
                pathSetAttributes(selectedCountry, 'click');
            }
            resetOldSelected(selectedOld); // Reset selectedOld
            callBack('click', selectedCountry);
        /*} else {
            console.log('drag...');
        }*/
    }

    // Hover over function for calling home from the outside, defined in 'svgMap.over' 
    // TODO: Optimize / refactor with window.countryOut
    var tooltip = document.createElement('div');
    tooltip.setAttribute('id', 'tooltip');
    tooltip.style.position = 'absolute';
    tooltip.style.background = 'rgba(0, 0, 0, 0.7)';
    tooltip.style.color = '#fff';
    tooltip.style.padding = '5px';
    tooltip.style.borderRadius = '5px';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.display = 'none';
    document.body.appendChild(tooltip);


    window.countryOver = function(id) {
        var country = countries[id];
        if (country != undefined && country != selectedCountry) {
            country.provinces.forEach(function(province) {
                pathSetAttributes(province, 'over');
                if (province.provinces != undefined) {
                    province.provinces.forEach(function(subprovince) {
                        pathSetAttributes(subprovince, 'over');
                    });
                }
            });
            setLabelFill(id, 'over');

            var tooltipText = "População: " + countryData[id].population + "\nPIB: " + countryData[id].GDP + "\nRegião: " + countryData[id].region + ((countryData[id].altnames==undefined||countryData[id].altnames==null)?"":("\nNomes alternativos: " + countryData[id].altnames));
            tooltip.style.display = 'block';
            tooltip.innerText = tooltipText;
        } else {
            province = findProvinceById(id);
            if (province != undefined) {
                pathSetAttributes(province, 'over');
                if (province.provinces != undefined) {
                    province.provinces.forEach(function(subprovince) {
                        pathSetAttributes(subprovince, 'over');
                    });
                }
            }
        }
    };

    window.countryOut = function(id) {
        var country = countries[id];
        if (country != undefined && country != selectedCountry) {
            country.provinces.forEach(function(province) {
                pathSetAttributes(province, 'out');
                if (province.provinces != undefined) {
                    province.provinces.forEach(function(subprovince) {
                        pathSetAttributes(subprovince, 'out');
                    });
                }
            });
            setLabelFill(id, 'out');
            tooltip.style.display = 'none';
        } else {
            province = findProvinceById(id);
            if (province != undefined) {
                pathSetAttributes(province, 'out');
                if (province.provinces != undefined) {
                    province.provinces.forEach(function(subprovince) {
                        pathSetAttributes(subprovince, 'out');
                    });
                }
            }
        }
    };



    // Click function for calling home from the outside, defined in 'svgMap.click' 
    window.countryClick = function(id) {
        var country = countries[id]; 
        var selectedOld = selectedCountry;
        // Set new selected
        if (country != undefined && country != selectedCountry) {
            country.provinces.forEach(function(province) { 
                pathSetAttributes(province, 'click'); 
                if (province.provinces != undefined) { province.provinces.forEach(function(subprovince) { pathSetAttributes(subprovince, 'click') }); } 
            }); 
            setLabelFill(id, 'click');
        } else {
            country = findProvinceById(id);
            pathSetAttributes(country, 'click');
        }
        selectedCountry = country; // New selected
        resetOldSelected(selectedOld); // Reset selectedOld
        callBack('click', country);
    }

    // Reset all colors and fills, function defined in 'svgMap.resetMap' 
    window.resetMap = function() {
        for (var country in countries) {
            if (countries[country].provinces != undefined) { 
                countries[country].provinces.forEach(function(province) { 
                    if (province.updateColor != undefined) { 
                        delete province.updateColor;
                        pathSetAttributes(province, 'out');
                    }
                    if (province.provinces != undefined) {
                        province.provinces.forEach(function(subprovince) { 
                            if (subprovince.updateColor != undefined) { 
                                delete subprovince.updateColor;
                                pathSetAttributes(subprovince, 'out');
                            }
                        });
                    }
                });
            }
        }
    }

    // Update function for calling home from the outside, defined in 'svgMap.update' 
    window.updateMapData = function(updateData) {
        for (var id in updateData) {
            if (countries[id] != undefined) {
                var country = countries[id]; 
            } else {
                var country = findProvinceById(id);
            }
            if (country != undefined) {
                if (country.provinces == undefined) { // Is mostly a province and no country. TODO: Rename variables? 
                    country.updateColor = updateData[id];
                    pathSetAttributes(country, updateData[id]);
                } else {
                    country.provinces.forEach(function(province) { 
                        province.updateColor = updateData[id];
                        pathSetAttributes(province, updateData[id]);
                        if (province.provinces != undefined) {
                            province.provinces.forEach(function(subprovince) { 
                                subprovince.updateColor = updateData[id];
                                pathSetAttributes(subprovince, updateData[id]);
                            });
                        }
                    }); 
                }
            } 
        };
    }

    // Update function for calling home from the outside, defined in 'svgMap.labels' 
    window.toggleMapLabels = function(updateLabels) {
        if (updateLabels == 'all') {
            var labelGroup = baseNode.getElementById('labels');
            if (labelGroup.getAttribute('display') == null || labelGroup.getAttribute('display') == 'block') {
                labelGroup.setAttribute('display', 'none');
            } else {
                labelGroup.setAttribute('display', 'block');
            }
        } else if (updateLabels == 'micro') {
            for (var label in countryLabels) {
                if (countryLabels[label].microstate == true) {
                    if (countryLabels[label].getAttribute('display') == null || countryLabels[label].getAttribute('display') == 'block') {
                        countryLabels[label].setAttribute('display', 'none');
                    } else {
                        countryLabels[label].setAttribute('display', 'block');
                    }
                }
            };
        }
    }

    // Export Map as SVG or PNG, defined in 'svgMap.download' 
    // TODO: Refactor + cleanup
    window.downloadMap = function(type) {
        var serializer = new XMLSerializer();
        var svgXML = serializer.serializeToString(svg.contentDocument);
        var blob = new Blob([svgXML], { type: "image/svg+xml;charset=utf-8" });
        var url = URL.createObjectURL(blob);
        if (type == 'svg') {
            var downloadLink = document.createElement("a");
            downloadLink.href = url;
            downloadLink.download = "world-map." + type;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
        } else if (type == 'png') {
            var canvas = document.createElement('canvas');
            var context = canvas.getContext('2d');
            var svgSize = baseNode.viewBox.baseVal;
            canvas.width = svgSize.width*2;
            canvas.height = svgSize.height*2;
            var data = new XMLSerializer().serializeToString(svg.contentDocument);
            var win = window.URL || window.webkitURL || window;
            var blob = new Blob([data], { type: 'image/svg+xml' });
            var url = win.createObjectURL(blob);
            var img = new Image();
            img.onload = function () {
                context.drawImage(img, 0, 0, canvas.width, canvas.height);
                win.revokeObjectURL(url);
                var uri = canvas.toDataURL('image/png').replace('image/png', 'octet/stream');
                var a = document.createElement('a');
                document.body.appendChild(a);
                a.style = 'display: none';
                a.href = uri;
                a.download = "world-map." + type;
                a.click();
                window.URL.revokeObjectURL(uri);
                document.body.removeChild(a);
            };
            img.src = url;
        } 
    }
    
    // Draw shape on map, defined in 'svgMap.shape' 
    window.drawShape = function(svgString) {
        var template = document.createElementNS(svgNS, 'svg');
        template.innerHTML = svgString;
        shapes.appendChild(template.firstChild);
    }

    // Caller for time controls to callback out, defined in 'svgMap.date' 
    window.timeControlsDate = function(currDate) {
        callBack('date', currDate);
    }

    // Parse HTML for <table> data, defined in 'svgMap.table' 
    window.parseHTMLTable = function(html) {
        tableData = {};
        var tableKeys = ['iso', 'name', 'country', 'countries', 'state', 'states', 'nation', 'nations', 'member state', 'member states', 'country or territory'];
        var dom = new DOMParser().parseFromString(html, "text/html");
        var tables = dom.getElementsByTagName('table');
        // Search for table to use
        loop_table:
        for (t=0; t<tables.length; t++) {
            var headers = tables[t].getElementsByTagName('th');
            for (h=0; h<headers.length; h++) {
                var headerText = stripHTML(headers[h].innerHTML);
                // Table key found
                if (tableKeys.indexOf(headerText.toLowerCase()) != -1) {
                    var tableNumber = t;
                    var tableKey = tableKeys[tableKeys.indexOf(headerText.toLowerCase())];
                    break loop_table;
                }
            }
        }
        // Scrape table if found
        if (tableNumber != undefined) {
            var table = dom.getElementsByTagName('table')[tableNumber];
            var headers = table.getElementsByTagName('th');
            var rows = table.getElementsByTagName('tr');
            var searchKey = new RegExp('(' + tableKey + ')', 'gi');
            var headerKey = '';
            var columnKeys = [];
            var timeTable = false;
            // Get header data
            for (h=0; h<headers.length; h++) {
                var headerText = stripHTML(headers[h].innerHTML);
                // Check if <th> has search key first
                if (headerText.search(searchKey) != -1) {
                    headerKey = headerText;
                }
                // Add <th> value to column keys
                if (headerText != '') {
                    columnKeys.push(headerText);
                }
            }
            // Check if table has time data = following numbers in a row
            if ( (!isNaN(columnKeys[1]) && !isNaN(columnKeys[2]) && !isNaN(columnKeys[3])) && // 3 numbers in a row
                 ( (parseInt(columnKeys[1])+1 == parseInt(columnKeys[2]) && parseInt(columnKeys[2])+1 == parseInt(columnKeys[3])) ||
                   (parseInt(columnKeys[1])-1 == parseInt(columnKeys[2]) && parseInt(columnKeys[2])-1 == parseInt(columnKeys[3])) ) ) {
                    timeTable = true;
                    /*if (isNaN(columnKeys[0])) {
                        columnKeys.splice(0, 1);
                    }*/
            }
            // Get rows data
            for (r=0; r<rows.length; r++) {
                var rowData = {};
                var columns = rows[r].getElementsByTagName('td');
                if (timeTable == true) { // Why?
                    var startColumn = 1;
                } else {
                    var startColumn = 0;
                }
                for (c=startColumn; c<columns.length; c++) {
                    var columnText = stripHTML(columns[c].innerHTML);
                    if (columnText != '') {
                        // Check if text is a number and convert it
                        if (/^[0-9,.]*$/.test(columnText) == true) {
                            columnText = Number(columnText.replace(/,/g, ""));
                        }
                        // Check if <td> has background color and add and value and color
                        if (columns[c].style.backgroundColor != undefined && columns[c].style.backgroundColor != '') {
                            // Add data for time animation
                            if (timeTable == true && parseHTMLTable.caller == null) { // Attention: function.caller in NOT supported in strict JavaScript! 
                                var countryKey = findIdByName(stripHTML(columns[0].innerHTML));
                                if (tableData[columnKeys[c]] == undefined) {
                                    tableData[columnKeys[c]] = {};
                                }
                                // Push country color to tableData directly if time animation is true
                                if (countryKey != undefined) {
                                    tableData[columnKeys[c]][countryKey] = columns[c].style.backgroundColor;
                                }
                                rowData[countryKey] = columns[c].style.backgroundColor;
                            // Or push other color for none animated but colored
                            } else {
                                rowData[columnKeys[c]] = { data: columnText, color: columns[c].style.backgroundColor };
                            }
                        // Or just add <td> value to row data
                        } else if (parseHTMLTable.caller != null) { // Attention: function.caller in NOT supported in strict JavaScript! 
                            rowData[columnKeys[c]] = columnText;
                        }
                    }
                }
                // Add row data to table data
                if (rowData[headerKey] != undefined) {
                    // Check if country has full name instead of ISO code and replace
                    if (rowData[headerKey].length > 2 && tableKey != 'iso') {
                        var countryKey = findIdByName(rowData[headerKey]);
                    } else {
                        var countryKey = rowData[headerKey];
                    }
                    // Skip table index (1, 2, 3...), only use iso country identifiers
                    if (isNaN(countryKey)) {
                        tableData[countryKey] = rowData;
                    }
                }
            }
        }
        // No table found or data not valid
        if (tableNumber == undefined || Object.keys(tableData)[0] == 'undefined') {
            tableData = { error: 'No valid data found in ' + tables.length + ' tables' };
        // Sort countries alphabetically 
        } else {
            tableData = sortObject(tableData);
        }
        // Return data
        callBack('table', tableData);
    }

    // Fire the (custom) callback functions, defined in 'options.mapOver', 'options.mapOut', 'options.mapClick', 'options.mapCoords', 'options.mapDate' and 'options.mapTable'
    function callBack(event, data) { // 'data' is a path except for coords and time controls date
        if (event == 'over' && window[options.mapOver] && typeof(window[options.mapOver]) === "function") { 
            window[options.mapOver].apply(window, [data]);
        } else if (event == 'out' && window[options.mapOut] && typeof(window[options.mapOut]) === "function") { 
            window[options.mapOut].apply(window, [data]);
        } else if (event == 'click' && window[options.mapClick] && typeof(window[options.mapClick]) === "function") { 
            if (data == undefined) { data = ''; } // If path is undefined (because of selectedCountry), return empty string
            window[options.mapClick].apply(window, [data]);
        } else if (event == 'coords' && window[options.mapCoords] && typeof(window[options.mapCoords]) === "function") { 
            window[options.mapCoords].apply(window, [data]);
        } else if (event == 'date' && window[options.mapDate] && typeof(window[options.mapDate]) === "function") { 
            window[options.mapDate].apply(window, [data]);
        } else if (event == 'table' && window[options.mapTable] && typeof(window[options.mapTable]) === "function") { 
            window[options.mapTable].apply(window, [data]);
        } 
    }

    // Build groups of countries with countryData (or passed JSON countryData) 
    function buildCountryGroups() {
        for (var country in countries) {
            // Check if country exists in countryData
            if (countryData[countries[country].id] != undefined) { 
                // Add new mainGroups and subGroups
                for (var i=0; i<options.groupBy.length; i++) {
                    var mainGroup = options.groupBy[i]; // E.g. "region"
                    var subGroup = countryData[countries[country].id][mainGroup]; // E.g. "EU"
                    // Add new mainGroup, if it doesn't exist
                    if (countryGroups[mainGroup] == undefined) { 
                        countryGroups[mainGroup] = {}; // New object for each mainGroup
                    }
                    if (subGroup != '') {
                        // Add new subGroup, if it doesn't exist
                        if (countryGroups[mainGroup][subGroup] == undefined) { 
                            countryGroups[mainGroup][subGroup] = {}; // New object for each subGroup
                        }
                        // Push country to subGroup
                        countryGroups[mainGroup][subGroup][countries[country].id] = countries[country]; 
                    }
                }
            } else {
                //console.log('Country data missing: ' + countries[country].id);
            }
        }
        // Sort groups alphabetically
        for (var group in countryGroups) {
            countryGroups[group] = sortObject(countryGroups[group]); 
        }
    }

    // Helper function to get text without HTML
    function stripHTML(input) {
        return input.replace(/(<br>)/ig, " ")
                    .replace(/(&nbsp;)/ig, " ")
                    .replace(/(<\/li><li>)/ig, " ")
                    .replace(/(\n)/ig, "")
                    .replace(/(\[.*\])/ig, "")
                    .replace(/(<([^>]+)>)/ig, "")
                    .trim();
    }

    // Helper function for object alphabetical sort
    function sortObject(input) {
        return Object.keys(input).sort().reduce(function (object, key) { 
            object[key] = input[key];
            return object;
        }, {});
    }

    // Reset the old selectedCountry
    function resetOldSelected(selectedOld) {
        if (selectedOld != undefined) {
            pathSetAttributes(selectedOld, 'out');
            if (selectedOld.provinces != undefined) {
                selectedOld.provinces.forEach(function(province) { 
                    pathSetAttributes(province, 'out'); 
                    if (province.provinces != undefined) {
                        province.provinces.forEach(function(subprovince) { 
                            pathSetAttributes(subprovince, 'out'); 
                        }); 
                    }
                }); 
            }
            setLabelFill(selectedOld.id, 'out'); // Reset selectedOld label
        }
    }

    // Find path in countries
    function findProvinceById(id) {
        for (var country in countries) {
            var provinces = countries[country].provinces;
            for (var province in provinces) {
                if (id == provinces[province].id) {
                    return provinces[province]; // No break needed if returned
                }
            }
        }
    }

    // Find id by country name
    function findIdByName(name) {
        // Remove "The ", e.g. from "The Bahamas"
        if (name.substr(0, 4).toLowerCase() == 'the ') { name = name.substr(4); }
        // Remove ", The", e.g. from "Bahamas, The"
        if (name.substr(-5).toLowerCase() == ', the') { name = name.substr(0, name.length-5); }
        // Remove last single characters, e.g. " b" from "Syrian Arab Republic  b"
        if (name.substr(-2, 1) == ' ') { name = name.substr(0, name.length-2); }
        // Remove special characters, e.g. "†"
        if (name.substr(-1, 1) == '†') { name = name.substr(0, name.length-1); }
        // Remove everything in brackets, e.g. "(France)" from "French Guiana (France)" and trim()
        name = name.replace(/(\(.*\))/ig, "").trim();
        // Search countries for name
        for (var country in countryData) {
            if (countryData[country].name == name) {
                return country; // No break needed if returned
            } else if (countryData[country].altnames != undefined && countryData[country].altnames.split(',').indexOf(name) != -1) {
                return country; 
            }
        }
    }
    
    // Mobile device detection
    function checkMobile() {
        if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|ipad|iris|kindle|Android|Silk|lge |maemo|midp|mmp|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(navigator.userAgent) 
            || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(navigator.userAgent.substr(0,4))) { 
            isMobile = true;
        }
    }

    // Check screen size
    function checkSize() {
        if (screen.width < 999) {
            if (screen.width < screen.height) {
                smallScreen = 'portrait';
            } else {
                smallScreen = 'landscape';
            }
        }
    }

    // Debug helper function for all countries and provinces
    function countCountries() {
        var countCountries = 0;
        var countProvinces = 0;
        for (var country in countries) {
            var countSub = 0;
            countCountries++;
            for (var province in countries[country].provinces) {
                countSub++;
                countProvinces++;
            }
            console.log(country + ': ' + countSub);
        }
        console.log('Total countries: ' + countCountries);
        console.log('Total provinces: ' + countProvinces);
    }

    // Fallback for countryData if no other is passed
    var countryData = { 
        "AD": { "name": "Andorra", "region": "EU", "population": "77,355", "GDP": "$3.24 billion" },
        "AE": { "name": "Emirados Árabes Unidos", "region": "AS", "population": "9.9 million", "GDP": "$421.14 billion" },
        "AF": { "name": "Afeganistão", "region": "AS", "population": "38.93 million", "GDP": "$19.29 billion" },
        "AG": { "name": "Antígua e Barbuda", "region": "NA", "population": "97,929", "GDP": "$1.69 billion" },
        "AI": { "name": "Anguila", "region": "NA", "population": "15,003", "GDP": "$337.8 million" },
        "AL": { "name": "Albânia", "region": "EU", "population": "2.87 million", "GDP": "$15.29 billion" },
        "AM": { "name": "Armênia", "region": "AS", "population": "2.97 million", "GDP": "$13.03 billion" },
        "AO": { "name": "Angola", "region": "AF", "population": "32.87 million", "GDP": "$88.38 billion" },
        "AQ": { "name": "Antártida", "region": "AN", "population": "Não aplicável", "GDP": "Não aplicável" },
        "AR": { "name": "Argentina", "region": "SA", "population": "45.92 million", "GDP": "$385.5 billion" },
        "AS": { "name": "Samoa Americana", "region": "OC", "population": "55,312", "GDP": "$658 million" },
        "AT": { "name": "Áustria", "region": "EU", "population": "8.79 million", "GDP": "$477.7 billion" },
        "AU": { "name": "Austrália", "region": "OC", "population": "25.78 million", "GDP": "$1.37 trillion" },
        "AW": { "name": "Aruba", "region": "SA", "population": "107,195", "GDP": "$2.52 billion" },
        "AX": { "name": "Ilhas Åland", "region": "EU", "population": "29,489", "GDP": "$1.52 billion" },
        "AZ": { "name": "Azerbaijão", "region": "AS", "population": "10.08 million", "GDP": "$46.27 billion" },
        "BA": { "name": "Bósnia e Herzegovina", "region": "EU", "population": "3.27 million", "GDP": "$20.92 billion" },
        "BB": { "name": "Barbados", "region": "SA", "population": "287,711", "GDP": "$5.04 billion" },
        "BD": { "name": "Bangladesh", "region": "AS", "population": "166.37 million", "GDP": "$352.4 billion" },
        "BE": { "name": "Bélgica", "region": "EU", "population": "11.48 million", "GDP": "$540.3 billion" },
        "BF": { "name": "Burkina Faso", "region": "AF", "population": "21.51 million", "GDP": "$16.85 billion" },
        "BG": { "name": "Bulgária", "region": "EU", "population": "6.91 million", "GDP": "$67.24 billion" },
        "BH": { "name": "Bahrein", "region": "AS", "population": "1.74 million", "GDP": "$37.92 billion" },
        "BI": { "name": "Burundi", "region": "AF", "population": "12.31 million", "GDP": "$3.24 billion" },
        "BJ": { "name": "Benin", "region": "AF", "population": "12.12 million", "GDP": "$12.16 billion" },
        "BL": { "name": "São Bartolomeu", "region": "NA", "population": "9,877", "GDP": "$286.8 million" },
        "BM": { "name": "Bermudas", "region": "NA", "population": "62,506", "GDP": "$7.56 billion" },
        "BN": { "name": "Brunei", "region": "AS", "population": "433,285", "GDP": "$13.17 billion" },
        "BO": { "name": "Bolívia", "region": "SA", "population": "11.51 million", "GDP": "$44.06 billion" },
        "BQ": { "name": "Bonaire, Santo Eustáquio e Saba", "region": "SA", "population": "20,320", "GDP": "$506 million" },
        "BR": { "name": "Brasil", "region": "SA", "population": "213.99 million", "GDP": "$2.14 trillion" },
        "BS": { "name": "Bahamas", "region": "NA", "population": "396,913", "GDP": "$12.14 billion" },
        "BT": { "name": "Butão", "region": "AS", "population": "791,919", "GDP": "$2.77 billion" },
        "BV": { "name": "Ilha Bouvet", "region": "AN", "population": "Não aplicável", "GDP": "Não aplicável" },
        "BW": { "name": "Botsuana", "region": "AF", "population": "2.35 million", "GDP": "$16.88 billion" },
        "BY": { "name": "Bielorrússia", "region": "EU", "population": "9.39 million", "GDP": "$60.29 billion" },
        "BZ": { "name": "Belize", "region": "NA", "population": "408,487", "GDP": "$1.87 billion" },

        "CA": { "name": "Canadá", "region": "NA", "population": "37.59 million", "GDP": "$1.85 trillion" },
        "CC": { "name": "Ilhas Cocos (Keeling)", "region": "AS", "population": "596", "GDP": "Não aplicável" },
        "CD": { "name": "Congo (Rep. Dem.)", "altnames": "República Democrática do Congo", "region": "AF", "population": "112.6 million", "GDP": "$49.47 billion" },
        "CF": { "name": "República Centro-Africana", "region": "AF", "population": "4.9 million", "GDP": "$2.39 billion" },
        "CG": { "name": "Congo", "altnames": "República do Congo", "region": "AF", "population": "5.53 million", "GDP": "$8.23 billion" },
        "CH": { "name": "Suíça", "region": "EU", "population": "8.69 million", "GDP": "$703.08 billion" },
        "CI": { "name": "Costa do Marfim", "region": "AF", "population": "26.38 million", "GDP": "$52.25 billion" },
        "CK": { "name": "Ilhas Cook", "region": "OC", "population": "17,564", "GDP": "$317 million" },
        "CL": { "name": "Chile", "region": "SA", "population": "19.52 million", "GDP": "$281.1 billion" },
        "CM": { "name": "Camarões", "region": "AF", "population": "27.64 million", "GDP": "$39.36 billion" },
        "CN": { "name": "China", "region": "AS", "population": "1.4 billion", "GDP": "$16.64 trillion" },
        "CO": { "name": "Colômbia", "region": "SA", "population": "50.34 million", "GDP": "$333.8 billion" },
        "CR": { "name": "Costa Rica", "region": "NA", "population": "5.15 million", "GDP": "$61.79 billion" },
        "CU": { "name": "Cuba", "region": "NA", "population": "11.33 million", "GDP": "$97.2 billion" },
        "CV": { "name": "Cabo Verde", "region": "AF", "population": "556,000", "GDP": "$2.02 billion" },
        "CW": { "name": "Curaçao", "region": "SA", "population": "164,093", "GDP": "$3.09 billion" },
        "CX": { "name": "Ilha Christmas", "region": "AS", "population": "2,205", "GDP": "Não aplicável" },
        "CY": { "name": "Chipre", "region": "EU", "population": "1.21 million", "GDP": "$24.27 billion" },
        "CZ": { "name": "República Tcheca", "region": "EU", "population": "10.71 million", "GDP": "$245.2 billion" },

        "DE": { "name": "Alemanha", "region": "EU", "population": "83.02 million", "GDP": "$4.24 trillion" },
        "DJ": { "name": "Djibuti", "region": "AF", "population": "1.03 million", "GDP": "$2.05 billion" },
        "DK": { "name": "Dinamarca", "region": "EU", "population": "5.85 million", "GDP": "$370.9 billion" },
        "DM": { "name": "Dominica", "region": "NA", "population": "71,625", "GDP": "$562 million" },
        "DO": { "name": "República Dominicana", "region": "NA", "population": "10.97 million", "GDP": "$91.05 billion" },
        "DZ": { "name": "Argélia", "region": "AF", "population": "44.63 million", "GDP": "$170.35 billion" },
        "EC": { "name": "Equador", "region": "SA", "population": "17.65 million", "GDP": "$109.48 billion" },
        "EE": { "name": "Estônia", "region": "EU", "population": "1.32 million", "GDP": "$35.75 billion" },
        "EG": { "name": "Egito", "region": "AF", "population": "104.26 million", "GDP": "$394.28 billion" },
        "EH": { "name": "Saara Ocidental", "altnames": "República Árabe Saaraui Democrática", "region": "AF", "population": "Não aplicável", "GDP": "Não aplicável" },
        "ER": { "name": "Eritreia", "region": "AF", "population": "3.5 million", "GDP": "$2.8 billion" },
        "ES": { "name": "Espanha", "region": "EU", "population": "46.94 million", "GDP": "$1.4 trillion" },
        "ET": { "name": "Etiópia", "region": "AF", "population": "120 million", "GDP": "$96.12 billion" },
        "FI": { "name": "Finlândia", "region": "EU", "population": "5.54 million", "GDP": "$306.94 billion" },
        "FJ": { "name": "Fiji", "region": "OC", "population": "896,444", "GDP": "$5.72 billion" },
        "FK": { "name": "Ilhas Malvinas", "region": "SA", "population": "2,910", "GDP": "$164.5 million" },
        "FM": { "name": "Micronésia", "region": "OC", "population": "105,544", "GDP": "$371 million" },
        "FO": { "name": "Ilhas Faroe", "region": "EU", "population": "49,290", "GDP": "$3.23 billion" },
        "FR": { "name": "França", "region": "EU", "population": "67.06 million", "GDP": "$3.06 trillion" },
        
        "GA": { "name": "Gabão", "region": "AF", "population": "2.29 million", "GDP": "$17.94 billion" },
        "GB": { "name": "Reino Unido", "region": "EU", "population": "67.44 million", "GDP": "$3.12 trillion" },
        "GD": { "name": "Granada", "region": "NA", "population": "112,003", "GDP": "$1.38 billion" },
        "GE": { "name": "Geórgia", "region": "AS", "population": "3.72 million", "GDP": "$17.85 billion" },
        "GF": { "name": "Guiana Francesa", "region": "SA", "population": "298,682", "GDP": "$5.5 billion" },
        "GG": { "name": "Guernsey", "region": "EU", "population": "67,052", "GDP": "$3.15 billion" },
        "GH": { "name": "Gana", "region": "AF", "population": "31.07 million", "GDP": "$71.18 billion" },
        "GI": { "name": "Gibraltar", "region": "EU", "population": "33,701", "GDP": "$2.93 billion" },
        "GL": { "name": "Groenlândia", "region": "NA", "population": "56,672", "GDP": "$2.72 billion" },
        "GM": { "name": "Gâmbia", "region": "AF", "population": "2.42 million", "GDP": "$1.49 billion" },
        "GN": { "name": "Guiné", "region": "AF", "population": "13.13 million", "GDP": "$10.05 billion" },
        "GP": { "name": "Guadalupe", "region": "NA", "population": "395,700", "GDP": "$9.14 billion" },
        "GQ": { "name": "Guiné Equatorial", "region": "AF", "population": "1.4 million", "GDP": "$12.38 billion" },
        "GR": { "name": "Grécia", "region": "EU", "population": "10.42 million", "GDP": "$209.85 billion" },
        "GS": { "name": "Geórgia do Sul e Ilhas Sandwich do Sul", "region": "AN", "population": "30", "GDP": "Não aplicável" },
        "GT": { "name": "Guatemala", "region": "NA", "population": "17.92 million", "GDP": "$85.47 billion" },
        "GU": { "name": "Guam", "region": "OC", "population": "167,294", "GDP": "$5.85 billion" },
        "GW": { "name": "Guiné-Bissau", "region": "AF", "population": "2.03 million", "GDP": "$1.5 billion" },
        "GY": { "name": "Guiana", "region": "SA", "population": "786,552", "GDP": "$3.63 billion" },
        "HK": { "name": "Hong Kong", "region": "AS", "population": "7.55 million", "GDP": "$383.4 billion" },
        "HM": { "name": "Ilha Heard e Ilhas McDonald", "region": "AN", "population": "Não aplicável", "GDP": "Não aplicável" },
        "HN": { "name": "Honduras", "region": "NA", "population": "9.75 million", "GDP": "$26.72 billion" },
        "HR": { "name": "Croácia", "region": "EU", "population": "4.05 million", "GDP": "$60.26 billion" },
        "HT": { "name": "Haiti", "region": "NA", "population": "11.4 million", "GDP": "$8.7 billion" },
        "HU": { "name": "Hungria", "region": "EU", "population": "9.65 million", "GDP": "$171.14 billion" },
        "ID": { "name": "Indonésia", "region": "AS", "population": "276.36 million", "GDP": "$1.12 trillion" },
        "IE": { "name": "Irlanda", "region": "EU", "population": "4.98 million", "GDP": "$387.89 billion" },
        "IL": { "name": "Israel", "region": "AS", "population": "9.29 million", "GDP": "$387.7 billion" },
        "IM": { "name": "Ilha de Man", "region": "EU", "population": "85,033", "GDP": "$7.34 billion" },
        "IN": { "name": "Índia", "region": "AS", "population": "1.39 billion", "GDP": "$2.91 trillion" },
        "IO": { "name": "Território Britânico do Oceano Índico", "region": "AS", "population": "3,000", "GDP": "Não aplicável" },
        "IQ": { "name": "Iraque", "region": "AS", "population": "41.65 million", "GDP": "$192.4 billion" },
        "IR": { "name": "Irã", "region": "AS", "population": "85.02 million", "GDP": "$445.94 billion" },
        "IS": { "name": "Islândia", "region": "EU", "population": "343,353", "GDP": "$31.12 billion" },
        "IT": { "name": "Itália", "region": "EU", "population": "60.36 million", "GDP": "$2.44 trillion" },
        "JE": { "name": "Jersey", "region": "EU", "population": "108,488", "GDP": "$6.32 billion" },
        "JM": { "name": "Jamaica", "region": "NA", "population": "2.95 million", "GDP": "$15.82 billion" },
        "JO": { "name": "Jordânia", "region": "AS", "population": "10.89 million", "GDP": "$46.06 billion" },
        "JP": { "name": "Japão", "region": "AS", "population": "126.3 million", "GDP": "$5.15 trillion" },
        "KE": { "name": "Quênia", "region": "AF", "population": "54.89 million", "GDP": "$95.5 billion" },
        "KG": { "name": "Quirguistão", "region": "AS", "population": "6.66 million", "GDP": "$8.75 billion" },
        "KH": { "name": "Camboja", "region": "AS", "population": "16.7 million", "GDP": "$29.57 billion" },
        "KI": { "name": "Quiribati", "region": "OC", "population": "119,449", "GDP": "$197 million" },
        "KM": { "name": "Comores", "region": "AF", "population": "873,724", "GDP": "$1.36 billion" },
        "KN": { "name": "São Cristóvão e Neves", "region": "NA", "population": "53,199", "GDP": "$1.04 billion" },
        "KP": { "name": "Coreia do Norte", "region": "AS", "population": "25.67 million", "GDP": "Não aplicável" },
        "KR": { "name": "Coreia do Sul", "region": "AS", "population": "51.71 million", "GDP": "$1.63 trillion" },
        "KW": { "name": "Kuwait", "region": "AS", "population": "4.33 million", "GDP": "$116.38 billion" },
        "KY": { "name": "Ilhas Cayman", "region": "NA", "population": "66,497", "GDP": "$4.28 billion" },
        "KZ": { "name": "Cazaquistão", "region": "AS", "population": "19.1 million", "GDP": "$184.7 billion" },
        
        "LA": { "name": "Laos", "region": "AS", "population": "7.53 million", "GDP": "$20.56 billion" },
        "LB": { "name": "Líbano", "region": "AS", "population": "6.85 million", "GDP": "$55.35 billion" },
        "LC": { "name": "Santa Lúcia", "region": "NA", "population": "184,401", "GDP": "$2.03 billion" },
        "LI": { "name": "Liechtenstein", "region": "EU", "population": "38,250", "GDP": "$6.83 billion" },
        "LK": { "name": "Sri Lanka", "region": "AS", "population": "21.41 million", "GDP": "$84.01 billion" },
        "LR": { "name": "Libéria", "region": "AF", "population": "5.06 million", "GDP": "$3.33 billion" },
        "LS": { "name": "Lesoto", "region": "AF", "population": "2.14 million", "GDP": "$2.72 billion" },
        "LT": { "name": "Lituânia", "region": "EU", "population": "2.79 million", "GDP": "$58.07 billion" },
        "LU": { "name": "Luxemburgo", "region": "EU", "population": "633,120", "GDP": "$74.46 billion" },
        "LV": { "name": "Letônia", "region": "EU", "population": "1.88 million", "GDP": "$34.3 billion" },
        "LY": { "name": "Líbia", "region": "AF", "population": "6.92 million", "GDP": "$72.84 billion" },
        "MA": { "name": "Marrocos", "region": "AF", "population": "37.17 million", "GDP": "$120.42 billion" },
        "MC": { "name": "Mônaco", "region": "EU", "population": "38,964", "GDP": "$7.67 billion" },
        "MD": { "name": "Moldávia", "region": "EU", "population": "2.64 million", "GDP": "$12.29 billion" },
        "ME": { "name": "Montenegro", "region": "EU", "population": "622,218", "GDP": "$5.58 billion" },
        "MF": { "name": "São Martinho (parte francesa)", "region": "NA", "population": "38,002", "GDP": "$561 million" },
        "MG": { "name": "Madagáscar", "region": "AF", "population": "28.43 million", "GDP": "$14.12 billion" },
        "MH": { "name": "Ilhas Marshall", "region": "OC", "population": "59,190", "GDP": "$234 million" },
        "MK": { "name": "Macedônia do Norte", "region": "EU", "population": "2.08 million", "GDP": "$13.22 billion" },
        "ML": { "name": "Mali", "region": "AF", "population": "20.25 million", "GDP": "$18.92 billion" },
        "MM": { "name": "Mianmar", "region": "AS", "population": "54.43 million", "GDP": "$81.59 billion" },
        "MN": { "name": "Mongólia", "region": "AS", "population": "3.28 million", "GDP": "$13.14 billion" },
        "MO": { "name": "Macau", "region": "AS", "population": "649,335", "GDP": "$55.47 billion" },
        "MP": { "name": "Ilhas Marianas do Norte", "region": "AS", "population": "57,216", "GDP": "$1.32 billion" },
        "MQ": { "name": "Martinica", "region": "NA", "population": "376,480", "GDP": "$9.14 billion" },
        "MR": { "name": "Mauritânia", "region": "AF", "population": "4.62 million", "GDP": "$7.44 billion" },
        "MS": { "name": "Montserrat", "region": "NA", "population": "4,989", "GDP": "$63.5 million" },
        "MT": { "name": "Malta", "region": "EU", "population": "514,564", "GDP": "$16.62 billion" },
        "MU": { "name": "Maurício", "region": "AF", "population": "1.27 million", "GDP": "$14.28 billion" },
        "MV": { "name": "Maldivas", "region": "AS", "population": "530,953", "GDP": "$5.64 billion" },
        "MW": { "name": "Malawi", "region": "AF", "population": "19.13 million", "GDP": "$7.59 billion" },
        "MX": { "name": "México", "region": "NA", "population": "130.26 million", "GDP": "$1.28 trillion" },
        "MY": { "name": "Malásia", "region": "AS", "population": "32.73 million", "GDP": "$364.7 billion" },
        "MZ": { "name": "Moçambique", "region": "AF", "population": "32.47 million", "GDP": "$15.75 billion" },
        "NA": { "name": "Namíbia", "region": "AF", "population": "2.59 million", "GDP": "$14.47 billion" },
        "NC": { "name": "Nova Caledônia", "region": "OC", "population": "287,800", "GDP": "$10.5 billion" },
        "NE": { "name": "Níger", "region": "AF", "population": "25.13 million", "GDP": "$8.11 billion" },
        "NF": { "name": "Ilha Norfolk", "region": "OC", "population": "2,210", "GDP": "Não aplicável" },
        "NG": { "name": "Nigéria", "region": "AF", "population": "206.14 million", "GDP": "$448.12 billion" },
        "NI": { "name": "Nicarágua", "region": "NA", "population": "6.65 million", "GDP": "$14.13 billion" },
        "NL": { "name": "Países Baixos", "region": "EU", "population": "17.48 million", "GDP": "$987.5 billion" },
        "NO": { "name": "Noruega", "region": "EU", "population": "5.44 million", "GDP": "$434.75 billion" },
        "NP": { "name": "Nepal", "region": "AS", "population": "29.71 million", "GDP": "$30.69 billion" },
        "NR": { "name": "Nauru", "region": "OC", "population": "10,824", "GDP": "$114 million" },
        "NU": { "name": "Niue", "region": "OC", "population": "1,618", "GDP": "Não aplicável" },
        "NZ": { "name": "Nova Zelândia", "region": "OC", "population": "4.92 million", "GDP": "$231.82 billion" },
        "OM": { "name": "Omã", "region": "AS", "population": "4.97 million", "GDP": "$61.82 billion" },
        
        "PA": { "name": "Panamá", "region": "NA", "population": "4.42 million", "GDP": "$68.73 billion" },
        "PE": { "name": "Peru", "region": "SA", "population": "33.12 million", "GDP": "$229.61 billion" },
        "PF": { "name": "Polinésia Francesa", "region": "OC", "population": "280,600", "GDP": "$6.49 billion" },
        "PG": { "name": "Papua-Nova Guiné", "region": "OC", "population": "9.17 million", "GDP": "$26.89 billion" },
        "PH": { "name": "Filipinas", "region": "AS", "population": "111.05 million", "GDP": "$376.8 billion" },
        "PK": { "name": "Paquistão", "region": "AS", "population": "225.20 million", "GDP": "$278.22 billion" },
        "PL": { "name": "Polônia", "region": "EU", "population": "37.97 million", "GDP": "$614.19 billion" },
        "PM": { "name": "Saint Pierre e Miquelon", "region": "NA", "population": "5,795", "GDP": "Não aplicável" },
        "PN": { "name": "Pitcairn", "region": "OC", "population": "47", "GDP": "Não aplicável" },
        "PR": { "name": "Porto Rico", "region": "NA", "population": "2.82 million", "GDP": "$104.99 billion" },
        "PS": { "name": "Palestina", "region": "AS", "population": "5.10 million", "GDP": "$14.50 billion" },
        "PT": { "name": "Portugal", "region": "EU", "population": "10.28 million", "GDP": "$237.05 billion" },
        "PW": { "name": "Palau", "region": "OC", "population": "18,008", "GDP": "$311 million" },
        "PY": { "name": "Paraguai", "region": "SA", "population": "7.53 million", "GDP": "$40.83 billion" },
        "QA": { "name": "Catar", "region": "AS", "population": "2.78 million", "GDP": "$156.28 billion" },
        "RE": { "name": "Reunião", "region": "AF", "population": "895,312", "GDP": "$8.96 billion" },
        "RO": { "name": "Romênia", "region": "EU", "population": "19.05 million", "GDP": "$250.05 billion" },
        "RS": { "name": "Sérvia", "region": "EU", "population": "6.91 million", "GDP": "$52.91 billion" },
        "RU": { "name": "Rússia", "region": "EU", "population": "144.48 million", "GDP": "$1.72 trillion" },
        "RW": { "name": "Ruanda", "region": "AF", "population": "12.63 million", "GDP": "$10.52 billion" },
        "SA": { "name": "Arábia Saudita", "region": "AS", "population": "35.41 million", "GDP": "$793.97 billion" },
        "SB": { "name": "Ilhas Salomão", "region": "OC", "population": "703,996", "GDP": "$1.42 billion" },
        "SC": { "name": "Seicheles", "region": "AF", "population": "98,347", "GDP": "$1.81 billion" },
        "SD": { "name": "Sudão", "region": "AF", "population": "44.91 million", "GDP": "$35.47 billion" },
        "SE": { "name": "Suécia", "region": "EU", "population": "10.45 million", "GDP": "$530.00 billion" },
        "SG": { "name": "Cingapura", "region": "AS", "population": "5.91 million", "GDP": "$372.06 billion" },
        "SH": { "name": "Santa Helena, Ascensão e Tristão da Cunha", "region": "AF", "population": "6,077", "GDP": "Não aplicável" },
        "SI": { "name": "Eslovênia", "region": "EU", "population": "2.08 million", "GDP": "$65.78 billion" },
        "SJ": { "name": "Svalbard e Jan Mayen", "region": "EU", "population": "2,667", "GDP": "Não aplicável" },
        "SK": { "name": "Eslováquia", "region": "EU", "population": "5.46 million", "GDP": "$107.08 billion" },
        "SL": { "name": "Serra Leoa", "region": "AF", "population": "8.16 million", "GDP": "$3.79 billion" },
        "SM": { "name": "San Marino", "region": "EU", "population": "33,860", "GDP": "$2.21 billion" },
        "SN": { "name": "Senegal", "region": "AF", "population": "17.91 million", "GDP": "$25.29 billion" },
        "SO": { "name": "Somália", "region": "AF", "population": "16.64 million", "GDP": "Não disponível" },
        "SR": { "name": "Suriname", "region": "SA", "population": "591,800", "GDP": "$3.71 billion" },
        "SS": { "name": "Sudão do Sul", "region": "AF", "population": "11.06 million", "GDP": "$3.63 billion" },
        "ST": { "name": "São Tomé e Príncipe", "region": "AF", "population": "221,415", "GDP": "$444 million" },
        "SV": { "name": "El Salvador", "region": "NA", "population": "6.52 million", "GDP": "$27.24 billion" },
        "SX": { "name": "São Martinho (parte holandesa)", "region": "NA", "population": "42,106", "GDP": "Não aplicável" },
        "SY": { "name": "Síria", "region": "AS", "population": "17.10 million", "GDP": "$15.40 billion" },
        "SZ": { "name": "Eswatini", "region": "AF", "population": "1.16 million", "GDP": "$5.77 billion" },        

        "TC": { "name": "Ilhas Turks e Caicos", "region": "NA", "population": "38,191", "GDP": "Não aplicável" },
        "TD": { "name": "Chade", "region": "AF", "population": "16.66 million", "GDP": "$15.84 billion" },
        "TF": { "name": "Territórios Franceses do Sul", "region": "AF", "population": "140", "GDP": "Não aplicável" },
        "TG": { "name": "Togo", "region": "AF", "population": "8.68 million", "GDP": "$5.45 billion" },
        "TH": { "name": "Tailândia", "region": "AS", "population": "69.80 million", "GDP": "$543.65 billion" },
        "TJ": { "name": "Tajiquistão", "region": "AS", "population": "9.54 million", "GDP": "$8.05 billion" },
        "TK": { "name": "Tokelau", "region": "OC", "population": "1,499", "GDP": "Não aplicável" },
        "TL": { "name": "Timor-Leste (Timor-Leste)", "region": "AS", "population": "1.36 million", "GDP": "$1.72 billion" },
        "TM": { "name": "Turcomenistão", "region": "AS", "population": "6.03 million", "GDP": "$42.32 billion" },
        "TN": { "name": "Tunísia", "region": "AF", "population": "12.21 million", "GDP": "$44.26 billion" },
        "TO": { "name": "Tonga", "region": "AF", "population": "106,915", "GDP": "$519 million" },
        "TR": { "name": "Turquia", "region": "AS", "population": "84.34 million", "GDP": "$761.43 billion" },
        "TT": { "name": "Trinidad e Tobago", "region": "NA", "population": "1.40 million", "GDP": "$21.21 billion" },
        "TV": { "name": "Tuvalu", "region": "OC", "population": "11,931", "GDP": "$46 million" },
        "TW": { "name": "Taiwan", "region": "AS", "population": "23.58 million", "GDP": "$665.77 billion" },
        "TZ": { "name": "Tanzânia", "region": "AF", "population": "61.50 million", "GDP": "$63.20 billion" },
        "UA": { "name": "Ucrânia", "region": "EU", "population": "41.61 million", "GDP": "$166.97 billion" },
        "UG": { "name": "Uganda", "region": "AF", "population": "47.73 million", "GDP": "$34.97 billion" },
        "UM": { "name": "Ilhas Menores Distantes dos Estados Unidos", "region": "OC", "population": "300", "GDP": "Não aplicável" },
        "US": { "name": "Estados Unidos", "region": "NA", "population": "332.47 million", "GDP": "$22.67 trillion" },
        "UY": { "name": "Uruguai", "region": "SA", "population": "3.48 million", "GDP": "$55.89 billion" },
        "UZ": { "name": "Uzbequistão", "region": "AS", "population": "34.40 million", "GDP": "$57.84 billion" },
        "VA": { "name": "Cidade do Vaticano", "region": "EU", "population": "800", "GDP": "Não aplicável" },
        "VC": { "name": "São Vicente e Granadinas", "region": "NA", "population": "110,608", "GDP": "$0.88 billion" },
        "VE": { "name": "Venezuela", "region": "SA", "population": "28.67 million", "GDP": "$76.17 billion" },
        "VG": { "name": "Ilhas Virgens Britânicas", "region": "NA", "population": "30,030", "GDP": "Não aplicável" },
        "VI": { "name": "Ilhas Virgens Americanas", "region": "NA", "population": "107,268", "GDP": "$4.23 billion" },
        "VN": { "name": "Vietnã", "region": "AS", "population": "98.97 million", "GDP": "$340.6 billion" },
        "VU": { "name": "Vanuatu", "region": "OC", "population": "307,145", "GDP": "$0.92 billion" },
        "WF": { "name": "Wallis e Futuna", "region": "OC", "population": "11,812", "GDP": "Não aplicável" },
        "WS": { "name": "Samoa", "region": "OC", "population": "199,424", "GDP": "$0.86 billion" },
        "XK": { "name": "Kosovo", "region": "EU", "population": "1.80 million", "GDP": "$7.98 billion" },
        "YE": { "name": "Iêmen", "region": "AS", "population": "31.37 million", "GDP": "$28.04 billion" },
        "YT": { "name": "Mayotte", "region": "AF", "population": "279,471", "GDP": "Não aplicável" },
        "ZA": { "name": "África do Sul", "region": "AF", "population": "60.52 million", "GDP": "$283.82 billion" },
        "ZM": { "name": "Zâmbia", "region": "AF", "population": "18.88 million", "GDP": "$26.60 billion" },
        "ZW": { "name": "Zimbábue", "region": "AF", "population": "14.86 million", "GDP": "$22.34 billion" }
    };

    // Global variables for time controls
    var timer; // Interval
    var currDate = 0; // Current day, month, year etc.
    var ticks = 0; // For speed
    var speed = 10; // For ticks per date
    var timeData = false;
    var maxDates = false;
    var loop = false;
    var paused = true;

    // Time controls
    function svgWorldMapTimeControls(timePause, timeLoop, initTimeData) { 

        // Check time dataset
        if (initTimeData != undefined) {
            timeData = initTimeData;
            // Convert time date from object to array
            if (typeof(timeData) == 'object' && Array.isArray(timeData) == false) {
                var timeHelper = [];
                var keys = Object.keys(timeData);
                for (var k=0; k<keys.length; k++) {
                    timeHelper.push({ [keys[k]]: timeData[keys[k]] });
                }
                timeData = timeHelper;
            }
            maxDates = timeData.length-1;
        }

        // Set pause at start (= autoplay)
        if (timePause == false) {
            paused = false;
        }

        // Set loop
        if (timeLoop == true) {
            loop = true;
        }

        // Dynamically load webfont
        document.getElementsByTagName('head')[0].insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="' + options.libPath + 'font/flaticon.css" />');

        // Start HTML injection
        initControls();
    }

    // Interval for day timer
    function initDayTimer() {
        timer = window.setInterval(function() {
            if (!paused) {
                increaseTimeTicks();
            }
        }, 100);
    }

    // 'Tick'-logic for time per speed
    function increaseTimeTicks() {
        ticks++;
        if (speed == 1 || (ticks % speed) == 1) {
            if (currDate < maxDates || maxDates == false) {
                currDate++;
            } else {
                if (loop) {
                    currDate = 0; // Return to start if loop is on
                } else {
                    paused = true; // Pause if last date of data is reached
                }
            }
            updateControls();
        }
    }

    // Slider control
    function initSilder() {
        if (timeData != false) {
            document.getElementById("map-slider").oninput = function() {
                paused = true;
                currDate = this.value;
                updateControls();
            } 
        } else {
            document.getElementById("map-slider").style.display = 'none';
            document.getElementById("map-slider-container").style.display = 'list-item';
            document.getElementById("map-slider-container").style.fontSize = '0';
        }
    }

    // Keyboard controls and start values
    function initKeyControls() {
        // Keyboard controls
        document.addEventListener('keyup', function(event) {
            if (event.keyCode == 32) { // Space
                document.getElementById("map-control-play-pause").firstChild.click();
            } else if (event.keyCode == 37) { // Arrow left
                document.getElementById("map-control-back").firstChild.click();
            } else if (event.keyCode == 38) { // Arrow up
                document.getElementById("map-control-start").firstChild.click();
            } else if (event.keyCode == 39) { // Arrow right
                document.getElementById("map-control-forward").firstChild.click();
            } else if (event.keyCode == 40) { // Arrow down
                document.getElementById("map-control-end").firstChild.click();
            } else if (event.keyCode == 171) { // Arrow right
                document.getElementById("map-control-faster").firstChild.click();
            } else if (event.keyCode == 173) { // Arrow down
                document.getElementById("map-control-slower").firstChild.click();
            }
        });
    }

    // Update controls output
    function updateControls() {
        if (paused) {
            document.getElementById("map-control-play-pause").innerHTML = '<i class="flaticon-play"></i>';
        } else {
            document.getElementById("map-control-play-pause").innerHTML = '<i class="flaticon-pause"></i>';
        }
        if (timeData && timeData.length > 0) {
            var dateKey = Object.keys(timeData[currDate])[0]; // Get date by first key
            document.getElementById("map-slider").value = currDate;
            document.getElementById("map-date").innerHTML = dateKey;
            //svgWorldMap.update(timeData[date][dateKey]); // Call update function in SVG World Map lib 
            svgMap.update(timeData[currDate][dateKey]); // Call update function in SVG World Map lib 
        } else {
            document.getElementById("map-date").innerHTML = currDate;
        }
        //svgWorldMap.date(date); // Call date and then callback function in SVG World Map 
        svgMap.date(currDate); // Call date and then callback function in SVG World Map lib 
    }

    // Play and pause controls
    window.clickPlayPause = function() {
        paused = !paused;
        updateControls();
    }

    // Controls for play, pause, forward, back, start, end
    window.clickControl = function() {
        var controlid = event.srcElement.parentNode.id; 
        if (controlid == 'map-control-start') {
            currDate = 0;
        } else if (controlid == 'map-control-end') {
            currDate = maxDates;
        } else if (controlid == 'map-control-back' && currDate > 0) {
            currDate--;
        } else if (controlid == 'map-control-forward' && currDate < maxDates) {
            currDate++;
        }
        paused = true;
        updateControls();
    }

    // Speed controls
    window.clickSpeed = function() {
        var speedid = event.srcElement.parentNode.id; 
        if (speedid == 'map-control-faster' && speed > 1) {
            speed--;
        } else if (speedid == 'map-control-slower' && speed < 20) {
            speed++;
        }
    }

    // HTML for time controls
    function initControls() {
        // Avoid double loading
        if (document.getElementById('map-controls') == null) {
            // Init CSS
            initControlsCSS();
            // Control elements
            var controlElements = { 'map-controls': { tag: 'div', append: 'svg-world-map-container' }, 
                                    'map-control-buttons': { tag: 'div', append: 'map-controls' }, 
                                    'map-control-start': { tag: 'button', append: 'map-control-buttons', icon: 'previous', click: 'clickControl()' }, 
                                    'map-control-back': { tag: 'button', append: 'map-control-buttons', icon: 'rewind', click: 'clickControl()' }, 
                                    'map-control-play-pause': { tag: 'button', append: 'map-control-buttons', icon: 'play', click: 'clickPlayPause()' }, 
                                    'map-control-forward': { tag: 'button', append: 'map-control-buttons', icon: 'fast-forward', click: 'clickControl()' }, 
                                    'map-control-end': { tag: 'button', append: 'map-control-buttons', icon: 'skip', click: 'clickControl()' }, 
                                    'map-slider-container': { tag: 'div', append: 'map-controls' }, 
                                    'map-slider': { tag: 'input', append: 'map-slider-container' }, 
                                    'map-speed-controls': { tag: 'div', append: 'map-controls' }, 
                                    'map-control-slower': { tag: 'button', append: 'map-speed-controls', icon: 'minus', click: 'clickSpeed()' }, 
                                    'map-control-faster': { tag: 'button', append: 'map-speed-controls', icon: 'plus', click: 'clickSpeed()' }, 
                                    'map-date': { tag: 'div', append: 'map-controls' } };
            // Create all elements dynamically
            for (var element in controlElements) {
                window[element] = document.createElement(controlElements[element].tag);
                window[element].setAttribute("id", element);
                window[controlElements[element].append].appendChild(window[element]);
                if (controlElements[element].tag == 'button') {
                    var i = document.createElement('i');
                    i.setAttribute("class", "flaticon-" + controlElements[element].icon);
                    window[element].appendChild(i);
                    window[element].setAttribute("onclick", controlElements[element].click);
                }
            }
            // Add missing attributes to slider
            document.getElementById("map-slider").setAttribute("type", "range");
            document.getElementById("map-slider").setAttribute("min", "0");
            document.getElementById("map-slider").setAttribute("max", maxDates);
            // Startup time control functions
            initKeyControls();
            initSilder();
            initDayTimer();
        }
    }

    // CSS for time controls
    function initControlsCSS() {
        var style = document.createElement('style');
        style.innerHTML = `
            #map-controls { position: absolute; bottom: 0; left: 0; right: 0; width: auto; height: 40px; padding: 0 10px; background-color: rgba(0, 0, 0, .75); }
            #map-control-buttons, #map-slider-container, #map-speed-controls, #map-date { float: left; }
            #map-control-buttons { width: 20%; }
            #map-slider-container { width: 60%; }
            #map-speed-controls, #map-date { width: 10%; text-align: right; }
            #map-date { margin-top: 10px; color: #FFFFFF; }
            #map-controls button { cursor: pointer; opacity: .5; margin-top: 10px; color: #FFFFFF; background-color: transparent; border: none; } /* broder: manu; */
            #map-controls button:hover { opacity: 1 !important; }
            #map-controls button i::before { margin: 0; }
            #map-speed-controls button i::before { font-size: 15px; font-weight: bold; }
            #map-slider { -webkit-appearance: none; width: 98%; height: 5px; border-radius: 5px; background: #8A8A8A; -moz-user-select: none; user-select: none; outline: none; margin: 17px 13px 0; }
            #map-slider:focus { outline: none; }
            #map-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 15px; height: 15px; border-radius: 50%; background: #FFFFFF; cursor: pointer; opacity: .5; }
            #map-slider::-moz-range-thumb { width: 15px; height: 15px; border-radius: 50%; background: #FFFFFF; cursor: pointer; opacity: .5; -moz-user-select: none; user-select: none; }
            #map-slider:hover::-webkit-slider-thumb, #map-slider:hover::-moz-range-thumb { opacity: 1; }
            @media all and (max-width: 999px) { 
                #map-control-buttons { width: 25%; }
                #map-slider-container { width: 50%; }
                #map-speed-controls, #map-date { width: 12.5%; }
                #map-controls button { margin-top: 12px; } 
                #map-controls button i::before { font-size: 15px; } 
                #map-speed-controls button i::before { font-size: 12px; } 
            }
            @media all and (max-width: 666px) { 
                #map-speed-controls { display: none; }
                #map-control-buttons, #map-date { position: absolute; bottom: 41px; height: 30px; padding-top: 10px; text-align: center; background-color: rgba(0, 0, 0, .75); }
                #map-control-buttons { left: 0; width: 50%; }
                #map-date { right: 0; width: calc(50% - 1px); }
                #map-controls button { margin-top: 0px; } 
                #map-slider-container { width: 100%; }
                #map-slider { width: 100%; margin: 17px 0 0; }
            }
        `;
        document.head.appendChild(style);
    }

    // Return the main function
    return svgWorldMap;

})();
