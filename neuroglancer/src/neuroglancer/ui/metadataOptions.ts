
import { Tab } from "../widget/tab_view";
import { cancellableFetchOk, responseJson } from 'neuroglancer/util/http_request';

export class MetadataOptionsTab extends Tab {

  //private content = "No metadataavailable"
  constructor() {
    super();

    var x = document.getElementsByClassName("neuroglancer-layer-item");
    //console.log(x)

    if (x !== null) {
      for (let i = 0; i < x.length; i++) {
        // console.log(x.item(i))
        let myNode = x.item(i)
        if (myNode != null) {
          //console.log(myNode.getAttribute('data-selected'))
          if (myNode.getAttribute('data-selected') === "true") {
            for (var j = 0; j < myNode.children.length; j++) {
              if (myNode.children[j].className == "neuroglancer-layer-item-label") {
                //console.log(myNode.childNodes[j].textContent)
                var content = "" + myNode.children[j].textContent
                const { element } = this;
                this.updateContent(element, content)
                break;
              }
            }
          }
        }
      }
    }



    //  let scope = this;


  }


  updateContent(element: any, selectedLayer: string) {
    var urlParams = new URLSearchParams(window.location.search);
    element.classList.add('neuroglancer-proteomics-info');

    if (urlParams.has('dataset_id')) {
      let dataset_id = urlParams.get('dataset_id')!;
      cancellableFetchOk("https://webdev.imp-db.cloud.edu.au:3002/" + dataset_id + "/" + selectedLayer.toLowerCase() + "/metadata.json", {}, responseJson)
        .then(response => {
          //console.log(response.toString())
          let responseElement = document.createElement('div')
          responseElement.className = "metadataOptions-content"
          for (var item of response["metadatacontent"]) {
            let rowEl = document.createElement('div')
            rowEl.className = "metadataOptions-row"
            rowEl.textContent = item
            responseElement.append(rowEl)
          }
          element.append(responseElement)
        })
        .catch(error => {
          console.error("No Metadata found for layer: " + selectedLayer + " :" + error);
          let responseElement = document.createElement('div')
          responseElement.className = "metadataOptions-content"
          responseElement.textContent = "No Metadata found for layer: " + selectedLayer
          element.append(responseElement)
        });
     
    }

  }
  //history.replaceState(null, '', removeParameterFromUrl(window.location.href, 'proteomics_url'));


}


