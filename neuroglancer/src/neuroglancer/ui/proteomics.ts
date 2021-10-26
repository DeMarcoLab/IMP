

import { Tab } from "../widget/tab_view";

export class ProteomicsOptionsTab extends Tab {
  m_clonedElement: HTMLElement
  constructor() {
    super();

    const { element } = this;
    element.textContent = ''

    let contentEl = document.getElementById("proteomics-content");
    console.log(contentEl)
    if (contentEl !== null) {
      this.m_clonedElement = contentEl?.cloneNode(true) as HTMLElement;
      this.m_clonedElement.id = "cloned-proteomics-content";
      console.log(this.m_clonedElement);
      element.append(this.m_clonedElement);
      this.m_clonedElement.style.display = "block";
    }
  }
}
