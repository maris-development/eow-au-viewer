import Icon from 'ol/style/Icon';
import TileWMS from 'ol/source/TileWMS';
import {
  Style,
  Fill
} from 'ol/style';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import Map from 'ol/Map';
import TileLayer from 'ol/layer/Tile';

import {HttpClient} from '@angular/common/http';

export class Layers {
  htmlDocument: Document;
  shapesLayerShape: any;
  shapesLayerFill: any;
  shapesLayerNames: any;
  wofsWMS: any;
  http: HttpClient;

  constructor(htmlDocument: Document, http: HttpClient) {
    this.htmlDocument = htmlDocument;
    this.http = http;
  }

  addLayers(map: Map) {
    this.addShapeFiles(map);
    this.addGADEAWOFS(map);
    this.setupLayerSelectionMenu(map);
  }

  private addShapeFiles(map: Map) {
    const iconStyle = new Style({
      image: new Icon({
        anchor: [0.5, 46],
        anchorXUnits: 'fraction',
        anchorYUnits: 'pixels',
        opacity: 0.75,
        scale: 0.02,
        src: '../assets/icon.png'
      })
    });
    const fillStyle = new Style({
      fill: new Fill({color: 'rgba(224, 255, 255, 0.33)'})
    });
    interface Options {
      style?: any;
      minZoom?: number;
      visible?: boolean;
    }
    const createLayer = (title, url, options: Options = {}) => {
      this.http.get(url).toPromise().then(d => console.log(`url exists: ${url}`)).catch(e => console.log(`URL DOES NOT EXIST: ${url}`));
      const newLayer = new VectorLayer(Object.assign(options, {
        title,
        source: new VectorSource({
          url,
          format: new GeoJSON(),
          projection : 'EPSG:4326'
        })
      }));
      newLayer.set('name', title);
      map.addLayer(newLayer);
      newLayer.setVisible(options.hasOwnProperty('visible') ? options.visible : true);
      return newLayer;
    };
    // Original data
    this.shapesLayerShape = createLayer('Waterbodies shape', '../assets/waterbodies/Australia/aus25wgd_l.geojson');
    this.shapesLayerFill = createLayer('Waterbodies fill', '../assets/waterbodies/Australia/aus25wgd_r.geojson',
      {style: fillStyle});
    this.shapesLayerNames = createLayer('Waterbodies name', '../assets/waterbodies/Australia/aus25wgd_p.geojson',
      {style: iconStyle, minZoom: 8});

    // new data but that only covers ACT + ~ 100kms square
    this.shapesLayerShape = createLayer('i5516 flats', '../assets/waterbodies/Canberra/i5516_flats.geojson');
    this.shapesLayerShape = createLayer('i5516 pondages', '../assets/waterbodies/Canberra/i5516_pondageareas.geojson');
    this.shapesLayerShape = createLayer('i5516 waterCourseLines', '../assets/waterbodies/Canberra/i5516_watercourselines.geojson',
      {visible: false});
    this.shapesLayerShape = createLayer('i5516 waterCourseAreas', '../assets/waterbodies/Canberra/i5516_watercourseareas.geojson');
    this.shapesLayerShape = createLayer('i5516 lakes', '../assets/waterbodies/Canberra/i5516_waterholes.geojson');
    this.shapesLayerShape = createLayer('i5516 reservoirs', '../assets/waterbodies/Canberra/i5516_reservoirs.geojson');
  }

  // Water Observations from Space 25m Filtered Summary (WOfS Filtered Statistics)
  // http://terria-cube.terria.io/ > Add data > DEA Production > Water Observations from Space > All time summaries
  // Discussed problem with rendering from DEA server with OpenDataCube slack group and worked out a solution.
  // Feedback also was that https://ows.services.dea.ga.gov.au has caching but https://ows.dea.ga.gov.au doesn't.  Use the later.
  private addGADEAWOFS(map: Map) {
    this.wofsWMS = new TileLayer({
      opacity: 0.6,
      source: new TileWMS({
        url: 'https://ows.dea.ga.gov.au',
        params: {
          LAYERS: 'wofs_filtered_summary',
          TILED: true
        },
        extent: [ -5687813.782846, 12530995.153909, -15894844.529378, 3585760.291316 ] // -13884991, -7455066, 2870341, 6338219]
      })
    });
    this.wofsWMS.set('name', 'Water Observations from Space');  // 25m Filtered Summary (WOfS Filtered Statistics)');
    map.addLayer(this.wofsWMS);
    this.wofsWMS.setVisible(true);
  }

  private setupLayerSelectionMenu(map: Map) {
    const generateCheckbox = (idCheckbox, labelName, htmlElement) => {
      const checkbox = this.htmlDocument.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = idCheckbox;
      const label = this.htmlDocument.createElement('label');
      label.htmlFor = idCheckbox;
      label.appendChild(this.htmlDocument.createTextNode(labelName));
      htmlElement.appendChild(checkbox);
      htmlElement.appendChild(label);
      return checkbox;
    };

    const layers = map.getLayers().getArray();
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i];
      const layerId = 'layer_id_' + layers[i].get('id');
      const name = layers[i].get('name');
      const checkbox = generateCheckbox( i, name, this.htmlDocument.querySelector('.layersSwitch'));

      // Manage when checkbox is (un)checked
      checkbox.addEventListener('change', function() {
        if (this.checked !== layer.getVisible()) {
          layer.setVisible(this.checked);
        }
      });

      // Manage when layer visibility changes outside of this
      layer.on('change:visible', function() {
        if (this.getVisible() !== checkbox.checked) {
          checkbox.checked = this.getVisible();
        }
      });

      // Set state the first time
      setTimeout(() => {
        checkbox.checked = layer.getVisible();
      }, 200);
    }
  }
}
