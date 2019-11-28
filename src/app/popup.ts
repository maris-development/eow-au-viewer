import Overlay from 'ol/Overlay';
import Map from 'ol/Map';
import {
  printStats,
  calculateStats,
} from './utils';
import colors from './colors.json';

export class Popup {
  elementId = 'popup';
  popup: any;
  htmlDocument: Document;
  userStore: any;
  pieChart: any;

  constructor(htmlDocument: Document, pieChart: any, userStore: any) {
    this.htmlDocument = htmlDocument;
    this.pieChart = pieChart;
    this.userStore = userStore;
  }

  /**
   * Create the map overlay.
   * @param elementId to draw into
   */
  init(map: Map) {
    if (! this.popup) {
      this.popup = new Overlay({
        element: this.htmlDocument.getElementById(this.elementId),
        position: [0, 0],
        autoPan: true,
        autoPanMargin: 275,
        positioning: 'center-left'
      });
      map.addOverlay(this.popup);
      this.setupEventHandlers();
    }
  }

  private setupEventHandlers() {
    // Popup dialog close button
    this.htmlDocument.getElementById(this.elementId).addEventListener('click', (event: Event) => {
      const element = (event.target as HTMLElement);
      if (element.matches('.close')) {
        this.popup.setVisible(false);
        this.popup.getElement().classList.remove('active');
      } else if (element.matches('.more-info-btn')) {
        const popupElement = element.closest('.popup-item');
        popupElement.classList.toggle('active');
      }
    });
  }

  getOverlay(): Overlay {
    if (! this.popup) {
      throw new Error('Popup / getOverlay - popup is null - it has not been initialised.');
    }

    return this.popup;
  }

  setVisible(visible: boolean) {
    this.popup.setVisible(visible);
  }

  draw(features: any, coordinate: any) {
    const element = this.popup.getElement();
    const content = element.querySelector('.content');
    const stats = element.querySelector('.stats');
    content.innerHTML = '';
    element.classList.remove('active');

    if (features.length) {
      content.innerHTML = features.map(this.printDetails).join('');
      stats.innerHTML = this.pieChart.fixForThisPieChart(printStats(calculateStats(features), this.userStore));
      element.classList.add('active');
      this.popup.setPosition(coordinate); // [28468637.79432749, 5368841.526355445]);  //
      this.popup.setVisible(true);
      this.pieChart.draw(features);
    } else {
      this.popup.setVisible(false);
    }
  }

  private printDetails(feature) {
    // Removed the geometry to avoid circular reference when serializing
    const properties = Object.assign(feature.getProperties(), {
      geometry: '*removed*'
    });

    const details = JSON.stringify(properties, null, 2);

    return `
      <div class="popup-item">
        <div class="metadata-row">
          <div class="image">
            <img src="${properties.image}" />
          </div>
          <div class="metadata">
            <div class="fu-preview"  style="background:${colors[properties.fu_value]}"></div>
            <div class="more-info-btn"></div>
            <div> FU value: ${properties.fu_value}</div>
            <div> Date: ${properties.date_photo}</div>
            <div> Device:  ${properties.device_model}</div>
          </div>
        </div>
        <div class="raw-details">
          <h4>Details<h4>
          <pre>
          ${details}
          </pre>
        </div>
      </div>
    `;
  }

}
