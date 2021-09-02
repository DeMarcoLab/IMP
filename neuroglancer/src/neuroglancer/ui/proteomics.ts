
import { Tab } from "../widget/tab_view";
import { cancellableFetchOk, responseJson } from 'neuroglancer/util/http_request';

export class ProteomicsOptionsTab extends Tab {

  constructor() {
    super();
    //console.log("test")
    const { element } = this;
    this.loadProteomicsFromURL(element)

  }


  loadProteomicsFromURL(element: any) {
    var urlParams = new URLSearchParams(window.location.search);

    if (urlParams.has('dataset_id')) {
      let dataset_id = urlParams.get('dataset_id')!;

      element.classList.add('neuroglancer-proteomics-info');

      //history.replaceState(null, '', removeParameterFromUrl(window.location.href, 'proteomics_url'));

      cancellableFetchOk("https://webdev.imp-db.cloud.edu.au:3002/"+dataset_id+"/proteomics/data.json", {}, responseJson)
        .then(response => {
          //console.log(response.toString())
          let responseElement = document.createElement('div')
          responseElement.className = "proteomics-content"
          let protTable = document.createElement("table")
          protTable.className = "proteomics-table"
          let tableHead = document.createElement("thead")

          let trEl = document.createElement("tr")
          trEl.className = "proteomics-row"
     
          let tdEl1 = document.createElement("td")
          tdEl1.textContent = "MPID"
          trEl.append(tdEl1)
          //console.log(trEl)
          let tdEl2 = document.createElement("td")
          tdEl2.textContent = "iBAQ"
          trEl.append(tdEl2)
          //console.log(trEl)
          tableHead.append(trEl)
          protTable.append(tableHead)
          let tbodyEl = document.createElement("tbody")
          protTable.append(tbodyEl)
          for (var item of response) {
            let rowEl = document.createElement('tr')
            rowEl.className = "proteomics-row"
            let tdEl1_ = document.createElement("td")
            tdEl1_.textContent = item["Majority protein ID"]
            rowEl.append(tdEl1_)
            let tdEl2_ = document.createElement("td")
            tdEl2_.textContent =  item["iBAQ"]
            rowEl.append(tdEl2_)
            tbodyEl.append(rowEl)
          }
          element.append(protTable)
        }),
      {
        initialMessage: `Retrieving state from json_url: ${dataset_id}.`,
        delay: true,
        errorPrefix: `Error retrieving state: `,
      };
    }

  }
}

/*https://webdev.imp-db.cloud.edu.au:3001/?proteomics_url=https://webdev.imp-db.cloud.edu.au:3002/YeastWithBubbles/proteomics/data.json#
!%7B%22dimensions%22:%7B%22x%22:%5B0.000003363538%2C%22m%22%5D%2C%22y%22:%5B0.0000032511860000000004%2C%22m%22%5D%2C%22z%22:%5B0.000001313114%2C%22m%22%5D%7D%2C%22
position%22:%5B933.0476684570312%2C939.542236328125%2C267.5%5D%2C%22
crossSectionScale%22:7.389056098930651%2C%22
projectionOrientation%22:%5B0.02329264208674431%2C-0.010805932804942131%2C0.04318646714091301%2C0.9987370371818542%5D%2C%22
projectionScale%22:4968.699164365893%2C%22
layers%22:%5B%7B%22type%22:%22image%22%2C%22source%22:%22precomputed://https://webdev.imp-db.cloud.edu.au:3002/YeastWithBubbles/8bit_big%22%2C%22tab%22:%22source%22%2C%22name%22:%228bit_big%22%2C%22visible%22:false%7D%2C%7B%22type%22:%22annotation%22%2C%22source%22:%22precomputed://https://webdev.imp-db.cloud.edu.au:3002/YeastWithBubbles/nucleosomes%22%2C%22tab%22:%22source%22%2C%22name%22:%22Nucleosomes%22%7D%2C%7B%22type%22:%22annotation%22%2C%22source%22:%22precomputed://https://webdev.imp-db.cloud.edu.au:3002/YeastWithBubbles/ribosomes%22%2C%22tab%22:%22source%22%2C%22annotationColor%22:%22#0400ff%22%2C%22name%22:%22ribosomes%22%7D%2C%7B%22type%22:%22annotation%22%2C%22source%22:%7B%22url%22:%22local://annotations%22%2C%22transform%22:%7B%22outputDimensions%22:%7B%22x%22:%5B0.000003363538%2C%22m%22%5D%2C%22y%22:%5B0.0000032511860000000004%2C%22m%22%5D%2C%22z%22:%5B0.000001313114%2C%22m%22%5D%7D%7D%7D%2C%22tool%22:%22annotateSphere%22%2C%22annotationColor%22:%22#ff00f7%22%2C%22annotations%22:%5B%7B%22center%22:%5B652%2C1067%2C312%5D%2C%22radii%22:%5B133.76177978515625%2C96.955810546875%2C48.503387451171875%5D%2C%22type%22:%22ellipsoid%22%2C%22id%22:%2259086a370294538ae4b6e4cb371ea9c2f20571ca%22%2C%22description%22:%22Pink%20blob%5Cn%22%7D%5D%2C%22name%22:%22new%20layer%22%2C%22visible%22:false%7D%5D%2C%22jsonStateServer%22:%22https://json.neurodata.io/v1%22%2C%22selectedLayer%22:%7B%22layer%22:%22Nucleosomes%22%2C%22visible%22:true%7D%2C%22layout%22:%22xy-3d%22%2C%22partialViewport%22:%5B0%2C0%2C1%2C1%5D%7D*/
