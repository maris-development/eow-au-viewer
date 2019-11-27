import {chart, Color, SeriesPieOptions, setOptions, map as highchartsMap} from 'highcharts';
import {colors} from './utils';

export class PieChart {
  elementId = 'pieChart';
  highchart: any;

  /**
   * If features are passed in (since one or more clicked on) then draw PieChart containing them.  If it is empty then draw chart of all
   * features visible.
   *
   * @param elementId - id of Element to draw chart in to
   * @param features - EOW Data
   * @param coordinate - the position of the mouse click in the viewport
   */
  draw(features) {
    if (this.highchart) {
      this.highchart.destroy();
      this.highchart = null;
    } else {
      const cArray = Object.keys(colors);
      const theFUColours = cArray.map(c => {
        const index = (parseInt(c, 10)) % cArray.length;
        // console.log(`colors length: ${cArray.length}, c: ${c}, color index: ${index}`);
        return colors[index];
      });
      // console.table(theFUColours);

      setOptions({
        colors: highchartsMap(theFUColours, (color) => {
          return {
            radialGradient: {
              cx: 0.5,
              cy: 0.3,
              r: 0.7
            },
            stops: [
              [0, color],
              [1, new Color(color).brighten(-0.2).get('rgb')] // darken
            ]
          };
        })
      });
    }

    const aggregateFUValues = (fuValuesInFeatures) => {
      const eowDataReducer = (acc, currentValue) => {
        acc[currentValue.values_.fu_value] = acc.hasOwnProperty(currentValue.values_.fu_value) ? ++acc[currentValue.values_.fu_value] : 1;
        return acc;
      };
      return features.reduce(eowDataReducer, {});
    };
    // Add zeros for all the other FUs since the colours in Highcharts pie charts are from the ordinal number of the data, NOT the value
    // of it's "name" attribute
    const setMissingFUsToZero = (fUValuesObj) => {
      return Object.keys(fUValuesObj).map(i => {
        return parseInt(i, 10);
      });
    };
    const arrayToObject = (array) =>
      array.reduce((obj, item) => {
        obj[item] = item;
        return obj;
      }, {});
    const addMissingFUValues = (existingFUs, missingFUs) => {
      Object.keys(colors).forEach((key, index) => {
        if (! missingFUs.hasOwnProperty(index)) {
          existingFUs[index] = 0;
        }
      });
      return existingFUs;
    };

    let eowDataFUValues = aggregateFUValues(features);
    const arrayFUValues = setMissingFUsToZero(eowDataFUValues);
    const arrayFUValuesObj = arrayToObject(arrayFUValues);

    eowDataFUValues = addMissingFUValues(eowDataFUValues, arrayFUValuesObj);

    const eowData = Object.keys(eowDataFUValues).map(k => {
      return {name: k, y: eowDataFUValues[k]};
    });
    console.log(`EOWData: ${JSON.stringify(eowData)}`);

    // Build the chart
    this.highchart = chart(this.elementId, {
      chart: {
        plotBackgroundColor: 'rgba(55, 255, 255, 0)',
        plotBorderWidth: 0,
        plotShadow: false,
        type: 'pie',
        height: '80px',
        width: 90
      },
      title: {
        text: ''  // FUIs on selected markers'
      },
      tooltip: {
        pointFormat: '{series.name}: <b>{point.percentage:.1f}%</b>'
      },
      plotOptions: {
        pie: {
          allowPointSelect: true,
          cursor: 'pointer',
          dataLabels: {
            enabled: false,
            format: '<b>{point.name}</b>: {point.percentage:.1f} %',
            connectorColor: 'brown'
          }
        }
      },
      series: [{
        name: 'Share',
        data: eowData
      } as SeriesPieOptions]
    });
  }

  /**
   *  Draw the pie chart of FU values selected, but the printStats() where the Pie Chart exists is used in other places
   *  Highcharts places its charts into an element with an id.  And as we know you can only have one id (since we only want one graph).
   *  Change the class to id in this one place.
   * @param html that contains 'class="pieChart"'
   */
  fixForThisPieChart(html: string) {
    return html.replace('class="pieChart"', 'id="pieChart"');
  }
}
