import {Component, OnInit, Inject, AfterViewInit} from '@angular/core';
import {DOCUMENT} from '@angular/common';
import debounce from 'lodash/debounce';
import keyBy from 'lodash/keyBy';
import groupBy from 'lodash/groupBy';
import Map from 'ol/Map';
import OSM from 'ol/source/OSM';
import TileLayer from 'ol/layer/Tile';
import View from 'ol/View';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import {fromLonLat} from 'ol/proj';

import GeoJSON from 'ol/format/GeoJSON';
import CircleStyle from 'ol/style/Circle';
import {
  Style,
  Stroke,
  Fill
} from 'ol/style';

import {
  colors,
  printStats,
  calculateStats,
  renderUsers,
  recentMeasurements
} from './utils';
import {HttpClient} from '@angular/common/http';
import {PieChart} from './pie-chart';
import {Popup} from './popup';
import {Layers} from './layers';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
  title = 'ng-eow';
  map: Map;
  popupObject: any;
  measurementStore: any;
  userStore: any;
  dataLayer: any;
  allDataSource: any;
  pieChart: any;
  layers: Layers;
  htmlDocument: Document;

  constructor(@Inject(DOCUMENT) private document: Document, private http: HttpClient) {
    this.htmlDocument = document;
    this.pieChart = new PieChart();
    // Fast datastructures to query the data
    this.userStore = {
      users: [],
      userById: {},
      getUserById(userId) {
        return this.userById[userId] || [];
      }
    };
    this.popupObject = new Popup(this.document, this.pieChart, this.userStore);
    this.layers = new Layers(this.document, this.http);
  }

  ngOnInit() {
    this.initMap();
    this.popupObject.init(this.map);
    this.layers.addLayers(this.map);

    const USER_SERVICE = 'https://www.eyeonwater.org/api/users';

    this.measurementStore = {
      measurements: [],
      measurementsById: {},
      measurementsByOwner: {},
      getByOwner(userId) {
        return this.measurementsByOwner[userId] || [];
      },
      getById(id) {
        return this.measurementsById[id] || [];
      }

    };

    async function loadUsers() {
      // TODO I'm curious as to if this is correct under Angular
      const response = await window.fetch(USER_SERVICE);
      const {
        results: {
          users
        }
      } = await response.json();
      return users;
    }

// Click events for panels
    this.document.getElementById('clearFilterButton').addEventListener('click', (event) => {
      this.clearFilter();
    });

// Load users
    loadUsers().then((users) => {
      this.userStore.users = users;
      this.userStore.userById = keyBy(this.userStore.users, 'id');
      renderUsers(this.userStore.users);
    });
    this.setupEventHandlers();
  }

  private initMap() {
    const WFS_URL = 'https://geoservice.maris.nl/wms/project/eyeonwater_australia?service=WFS'
      + '&version=1.0.0&request=GetFeature&typeName=eow_australia&maxFeatures=5000&outputFormat=application%2Fjson';
    const styleCache = {};

    this.allDataSource = new VectorSource({
      format: new GeoJSON(),
      url: WFS_URL
    });
    this.allDataSource.on('change', this.initialLoadMeasurements.bind(this));

// Style Features using ..... FU values (called for each feature on every render call)
    const basicStyle = (feature, resolution) => {
      const fuValue = feature.get('fu_value');
      const styleKey = `${fuValue}_${resolution}`;
      // Avoid some unnecessary computation
      if (styleCache[styleKey]) {
        return styleCache[styleKey];
      }
      feature.set('visible', true);
      const styleOptions = {
        image: new CircleStyle({
          radius: this.map.getView().getZoom() * Math.log2(5),
          stroke: new Stroke({
            color: 'white'
          }),
          fill: new Fill({
            color: colors[fuValue]
          })
        })
      };

      styleCache[styleKey] = new Style(styleOptions);
      return styleCache[styleKey];
    };
    this.dataLayer = new VectorLayer({
      source: this.allDataSource,
      style: basicStyle
    });
    this.dataLayer.set('name', 'EOW Data');

    this.dataLayer.on('change', debounce(({
                                            target
                                          }) => {
      // Populate datalayer
      const element = this.document.querySelector('.sub-header-stats') as HTMLElement;
      element.innerHTML = printStats(calculateStats(target.getSource().getFeatures()), this.userStore);
    }, 200));
    const mainMap = new TileLayer({
      source: new OSM()
    });
    mainMap.set('name', 'Main map');

    this.map = new Map({
      target: 'map',
      layers: [
        mainMap,
        this.dataLayer
      ],
      view: new View({
        center: fromLonLat([133.945313, -26.431228]),
        zoom: 4
      }),
      controls: [],
    });

    this.map.on('click', (evt) => {
      const {
        pixel,
        coordinate
      } = evt;

      const features = [];

      this.map.forEachFeatureAtPixel(pixel, (feature) => {
        features.push(feature);
      });

      if (features.length) {
        console.log(`Clicked on map at: ${JSON.stringify(coordinate)}`);
        this.popupObject.draw(features, coordinate);
      }
    });
  }

  private setupEventHandlers() {
    // Pull tabs of Most Active Users and Recent Measurements
    this.document.querySelectorAll('.pull-tab').forEach(i => i.addEventListener('click', (event: Event) => {
      const element = (event.target as HTMLElement).closest('.panel');
      element.classList.toggle('pulled');
    }));
    // User List
    document.querySelector('.user-list').addEventListener('click', (event) => {
      const element = (event.target as HTMLElement).closest('.item');
      const userId = element.getAttribute('data-user');

      if (this.showMeasurements(userId)) {
        this.clearSelectedUser();
        element.classList.add('selectedUser', 'box-shadow');
        this.toggleFilterButton(true);
      }
    }, true);

    // Measurement List
    document.querySelector('.measurement-list').addEventListener('click', (event) => {
      const element = (event.target as HTMLElement).closest('.item');
      if (!element) {
        return;
      }

      const coordinate = element.getAttribute('data-coordinate').split(',');
      const id = element.getAttribute('data-key');
      const view = this.map.getView();
      view.cancelAnimations();
      view.animate({
        center: coordinate,
        zoom: 8,
        duration: 1300
      });
      const features = [this.measurementStore.getById(id)];
      this.popupObject.draw(features, coordinate);
    }, true);
  }

  private initialLoadMeasurements(event) {
    const source = event.target;
    if (!source.loading) {
      const features = this.allDataSource.getFeatures();
      // Store the measurements in easy to access data structure
      this.measurementStore.measurements = features;
      this.measurementStore.measurementsById = keyBy(features, f => f.get('n_code'));
      this.measurementStore.measurementsByOwner = groupBy(features, f => f.get('user_n_code'));

      recentMeasurements(this.measurementStore.measurements);
      this.allDataSource.un('change', this.initialLoadMeasurements);
    }
  }


  private showMeasurements(userId = null) {
    const newSource = new VectorSource();
    const selection = this.measurementStore.getByOwner(userId);
    if (!selection.length) {
      return false;
    }
    newSource.addFeatures(selection);
    this.map.getView().fit(newSource.getExtent(), {
      size: this.map.getSize(),
      padding: [100, 100, 100, 100],
      nearest: false,
      duration: 1300
    });
    this.dataLayer.setSource(newSource);
    recentMeasurements(selection);
    return true;
  }

  private clearFilter() {
    this.dataLayer.setSource(this.allDataSource);
    this.clearSelectedUser();
    recentMeasurements(this.measurementStore.measurements);
    this.map.getView().fit(this.dataLayer.getSource().getExtent(), {duration: 1300});
    this.toggleFilterButton(false);
  }

  private toggleFilterButton(state = false) {
    const element = this.document.getElementById('clearFilterButton');
    element.classList.toggle('hidden', !state);
  }

  private clearSelectedUser() {
    this.document.querySelectorAll('.user-list .item').forEach(item => {
      item.classList.remove('selectedUser', 'box-shadow');
    });
  }
}
