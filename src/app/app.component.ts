import {Component, OnInit, Inject, AfterViewInit} from '@angular/core';
import {DOCUMENT} from '@angular/common';
import Map from 'ol/Map';
import OSM from 'ol/source/OSM';
import TileLayer from 'ol/layer/Tile';
import View from 'ol/View';
import {fromLonLat} from 'ol/proj';
import {HttpClient} from '@angular/common/http';
import {PieChart} from './pie-chart';
import {Popup} from './popup';
import {Layers} from './layers';
import {MeasurementStore} from './measurement-store';
import {UserStore} from './user-store';
import {EowDataLayer} from './eow-data-layer';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
  title = 'ng-eow';
  map: Map;
  popupObject: any;
  measurementStore: MeasurementStore;
  userStore: UserStore;
  eowData: EowDataLayer;
  dataLayer: any;
  allDataSource: any;
  pieChart: any;
  layers: Layers;
  htmlDocument: Document;

  constructor(@Inject(DOCUMENT) private document: Document, private http: HttpClient) {
    this.htmlDocument = document;
    this.pieChart = new PieChart();

    this.userStore = new UserStore(this.document);
    this.popupObject = new Popup(this.document, this.pieChart, this.userStore);
    this.layers = new Layers(this.document, this.http);
    this.measurementStore = new MeasurementStore();
    this.eowData = new EowDataLayer();
  }

  ngOnInit() {
    this.initMap();
    this.popupObject.init(this.map);
    this.measurementStore.init(this.map, this.dataLayer, this.allDataSource);
    this.layers.addLayers(this.map);
    this.userStore.init();
    this.eowData.init(this.map, this.htmlDocument, this.userStore, this.measurementStore);

    this.setupEventHandlers();
  }

  private initMap() {
    const mainMap = new TileLayer({
      source: new OSM()
    });
    mainMap.set('name', 'Main map');

    this.map = new Map({
      target: 'map',
      layers: [
        mainMap,
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

      if (this.measurementStore.showMeasurements(userId)) {
        this.userStore.clearSelectedUser();
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

    this.document.getElementById('clearFilterButton').addEventListener('click', (event) => {
      this.clearFilter();
    });
  }

  private clearFilter() {
    this.dataLayer.setSource(this.allDataSource);
    this.userStore.clearSelectedUser();
    this.measurementStore.clearFilter();
    this.map.getView().fit(this.dataLayer.getSource().getExtent(), {duration: 1300});
    this.toggleFilterButton(false);
  }

  private toggleFilterButton(state = false) {
    const element = this.document.getElementById('clearFilterButton');
    element.classList.toggle('hidden', !state);
  }
}
