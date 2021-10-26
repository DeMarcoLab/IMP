
import { Tab } from "../widget/tab_view";

export class MetadataOptionsTab extends Tab {
  m_clonedElement: HTMLElement
  constructor() {
    super();
    
    const { element } = this;
    element.textContent =''
 
    let mainEl = document.getElementById("metadataOptions-content");
    this.m_clonedElement = mainEl?.cloneNode(true) as HTMLElement
    if(this.m_clonedElement){
      this.m_clonedElement.id="cloned-metadata-block"
   
      this.m_clonedElement.style.display = "block";
      element.append(this.m_clonedElement);
    }
    var x = document.getElementsByClassName("neuroglancer-layer-item");
    //console.log(x)
    //find out which layer is selected
    if (x !== null) {
      for (let i = 0; i < x.length; i++) {
        // console.log(x.item(i))
        let myNode = x.item(i);
        if (myNode != null) {
          //console.log(myNode.getAttribute('data-selected'))
          if (myNode.getAttribute('data-selected') === "true") {
            for (var j = 0; j < myNode.children.length; j++) {
              if (myNode.children[j].className == "neuroglancer-layer-item-label") {
                //console.log(myNode.childNodes[j].textContent)
                var content = "" + myNode.children[j].textContent;
                this.updateContent(element, content);
                break;
              }
            }
          }
        }
      }
    }
  }


  updateContent(element: any, selectedLayer: string) {

    element.classList.add('neuroglancer-metadata-info');
    //let layernodes = element.children.lastChild
  
    let metadatalayer = element.children[0].children[element.children[0].children.length-1]
    for(let i =1; i <metadatalayer.children.length; i++){

      if(metadatalayer.children[i].className === "layer-metadata-" + selectedLayer){
        metadatalayer.children[i].style.display = "block"
      } else {
        metadatalayer.children[i].style.display = "none"
      }
    }

  }

}


