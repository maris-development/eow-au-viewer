import {Component, ElementRef, ViewChild, AfterViewInit, OnInit, Inject} from '@angular/core';
import {DOCUMENT} from '@angular/common';
// import './css/styles.css';
import debounce from 'lodash/debounce';
import keyBy from 'lodash/keyBy';
import groupBy from 'lodash/groupBy';
import {HostListener} from '@angular/core';

// import {
//   Map,
//   View,
//   Overlay
// } from 'ol';
// import {
//   fromLonLat
// } from 'ol/proj';
// import {
//   Tile as TileLayer,
//   Vector as VectorLayer
// } from 'ol/layer';
// import {
//   OSM,
//   Vector as VectorSource
// } from 'ol/source';
import Map from 'ol/Map';
import XYZ from 'ol/source/XYZ';
import OSM from 'ol/source/OSM';
import TileLayer from 'ol/layer/Tile';
import View from 'ol/View';
import VectorSource from 'ol/source/Vector';
import Overlay from 'ol/Overlay';
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
  printDetails,
  printStats,
  calculateStats,
  renderUsers,
  recentMeasurements
} from './utils';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit, AfterViewInit {
  // @ViewChild('popup', {static: false}) popupEl: ElementRef;
  title = 'ng-eow';
  map: Map;
  popup: any;
  measurementStore: any;
  userStore: any;
  dataLayer: any;
  allDataSource: any;

  constructor(@Inject(DOCUMENT) private document: Document) {
  }

  ngAfterViewInit() {
    this.map.setTarget('map');
  }

  ngOnInit() {

// The WFS provided by EyeOnWater.org for Australia data
    const WFS_URL = 'https://geoservice.maris.nl/wms/project/eyeonwater_australia?service=WFS'
      + '&version=1.0.0&request=GetFeature&typeName=eow_australia&maxFeatures=5000&outputFormat=application%2Fjson';
    const USER_SERVICE = 'https://www.eyeonwater.org/api/users';
    const styleCache = {};
    // this.map = null;
    this.allDataSource = new VectorSource({
      format: new GeoJSON(),
      url: WFS_URL
    });

// Fast datastructures to query the data
    this.userStore = {
      users: [],
      userById: {},
      getUserById(userId) {
        return this.userById[userId] || [];
      }
    };
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
// Get measurements from layer after it's done loading.
    this.allDataSource.on('change', this.initialLoadMeasurements.bind(this));

    this.popup = new Overlay({
      // element: this.popupEl.nativeElement,  // document.getElementById('popup'),
      // element: this.document.getElementById('popup'),
      element: this.document.getElementById('popup'),
      position: [0, 0],
      autoPan: true,
      autoPanMargin: 275,
      positioning: 'bottom-center'
    });

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

    this.dataLayer.on('change', debounce(({
                                       target
                                     }) => {
      // Populate datalayer
      const element = this.document.querySelector('.sub-header-stats') as HTMLElement;
      element.innerHTML = printStats(calculateStats(target.getSource().getFeatures()), this.userStore);
    }, 200));

    this.map = new Map({
      target: 'map',
      layers: [
        new TileLayer({
          source: new OSM()
        }),
        this.dataLayer
      ],
      view: new View({
        center: fromLonLat([133.07421121913038, 28.566680043403878]),
        zoom: 2
      }),
      controls: []
    });

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

// Attach overlay and hide it
    this.map.addOverlay(this.popup);
    this.popup.setVisible(false);

// Click events for panels
    this.document.getElementById('clearFilterButton').addEventListener('click', (event) => {
      this.clearFilter();
    });

// Show popup with features at certain point on the map
    this.map.on('click', (evt) => {
      const {
        pixel,
        coordinate
      } = evt;

      // clean up old popup and initilize some variables
      this.popup.setVisible(false);
      const element = this.popup.getElement();
      const content = element.querySelector('.content');
      const stats = element.querySelector('.stats');
      content.innerHTML = '';
      element.classList.remove('active');

      const features = [];

      this.map.forEachFeatureAtPixel(pixel, (feature) => {
        features.push(feature);
      });

      if (features.length) {
        content.innerHTML = features.map(printDetails).join('');
        stats.innerHTML = printStats(calculateStats(features), this.userStore);
        element.classList.add('active');
        this.popup.setPosition(coordinate);
      }
    });
// Load users
    loadUsers().then((users) => {
      this.userStore.users = users;
      this.userStore.userById = keyBy(this.userStore.users, 'id');
      renderUsers(this.userStore.users);
    });

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    // Pull tabs of Most Active Users and Recent Measurements
    this.document.querySelectorAll('.pull-tab').forEach(i => i.addEventListener('click', (event: Event) => {
      const element = (event.target as HTMLElement).closest('.panel');
      element.classList.toggle('pulled');
    }));

    // Popup dialog close button
    this.document.querySelector('#popup').addEventListener('click', (event: Event) => {
      const element = (event.target as HTMLElement);
      if (element.matches('.close')) {
        this.popup.setVisible(false);
        this.popup.getElement().classList.remove('active');
      } else if (element.matches('.more-info-btn')) {
        const popupElement = element.closest('.popup-item');
        popupElement.classList.toggle('active');
      }
    });

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
        zoom: 7,
        duration: 1300
      });
      // clean up old popup and initilize some variables
      this.popup.setVisible(false);
      const popupElement = this.popup.getElement();
      const content = popupElement.querySelector('.content');
      const stats = popupElement.querySelector('.stats');
      content.innerHTML = '';
      popupElement.classList.remove('active');

      const features = [this.measurementStore.getById(id)];

      if (features.length) {
        content.innerHTML = features.map(printDetails).join('');
        stats.innerHTML = printStats(calculateStats(features), this.userStore);
        popupElement.classList.add('active');

        this.popup.setPosition(coordinate);
      }
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
