/* script.js */

/*******************************************************
 *  Enkelt mock-register för ärenden, t.ex. “Ändring av revisor”
 *  eller “Ändring av företrädare”.
 *******************************************************/
const mockArenden = {
  "R654321/24": {
    företag: {
      namn: "Ångloket 16 Fastighets AB",
      orgnr: "559065-7795",
      bolagsform: "Aktiebolag"
    },
    ärende: {
      rubrik: "Ändring av företrädare / firmateckning",
      nummer: "R654321/24",
      status: "Handläggning pågår",
      händelser: []
    }
  },
  "R4321/24": {
    företag: {
      namn: "Telefoni AB",
      orgnr: "556677-1122",
      bolagsform: "Aktiebolag"
    },
    ärende: {
      rubrik: "Ändring av revisor",
      nummer: "R4321/24",
      status: "Komplettering inkommen",
      händelser: [{
          typ: "Komplettering",
          datum: "2024-12-09"
        },
        {
          typ: "Föreläggande",
          datum: "2024-12-06"
        }
      ]
    }
  }
};

/*******************************************************
 * Global bokföring av aktiva flikar
 *******************************************************/
let tabCounter = 1; // Har redan en flik (#1)
const tabsData = {
  "1": { // flik 1’s data
    arendenummer: "R654321/24" // pekar på existerande mockArenden
  }
};

/*******************************************************
 * Hämta relevanta element
 *******************************************************/
const tabListEl = document.getElementById("tabList");
const mainContentEl = document.getElementById("mainContent");

const globalSearchInput = document.getElementById("globalSearchInput");
const openTabSelect = document.getElementById("openTabSelect");
const globalFetchBtn = document.getElementById("globalFetchBtn");
const addTabBtn = document.getElementById("addTabBtn");

/*******************************************************
 * Init
 *******************************************************/
window.addEventListener("DOMContentLoaded", () => {
  // Koppla event
  addTabBtn.addEventListener("click", () => createNewTab());
  globalFetchBtn.addEventListener("click", handleGlobalSearch);

  // Visa data i flik #1
  renderTabPanel("1");
});

/*******************************************************
 * Hantera global sökning
 *******************************************************/
function handleGlobalSearch() {
  const searchTerm = globalSearchInput.value.trim();
  if (!searchTerm) {
    alert("Fyll i ett ärendenummer, t.ex. R4321/24");
    return;
  }
  const found = mockArenden[searchTerm];
  if (!found) {
    alert("Inget ärende hittades för söktermen: " + searchTerm);
    return;
  }

  const openMode = openTabSelect.value; // "current" eller "new"

  if (openMode === "current") {
    // Öppna i nuvarande aktiva flik
    const activeTabId = getActiveTabId();
    tabsData[activeTabId].arendenummer = searchTerm;
    renderTabPanel(activeTabId);
  } else {
    // Öppna i ny flik
    const newId = createNewTab();
    tabsData[newId].arendenummer = searchTerm;
    renderTabPanel(newId);
    activateTab(newId);
  }
}

/*******************************************************
 * Flik-hantering
 *******************************************************/
// Skapar en ny tom flik (ingen ärende-data ännu)
function createNewTab() {
  tabCounter++;
  const tabId = tabCounter.toString();

  // Registrera default-data
  tabsData[tabId] = {
    arendenummer: null
  };

  // Skapa LI-element
  const li = document.createElement("li");
  li.className = "tab-item";
  li.setAttribute("data-tab-id", tabId);
  li.setAttribute("role", "tab");
  li.setAttribute("aria-selected", "false");
  li.id = `tab-id-${tabId}`;
  li.textContent = "Ny flik";

  // Skapa stäng-knapp
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "close-tab-btn";
  closeBtn.textContent = "×";
  closeBtn.setAttribute("aria-label", "Stäng denna flik");
  closeBtn.onclick = (e) => closeTab(e, tabId);
  li.appendChild(closeBtn);

  // Infoga före sista “+” (new-tab)
  const plusTab = tabListEl.querySelector(".new-tab");
  tabListEl.insertBefore(li, plusTab);

  // Skapa panel-element
  const section = document.createElement("section");
  section.id = `tabPanel${tabId}`;
  section.className = "tab-panel hidden"; // dold initialt
  section.setAttribute("role", "tabpanel");
  section.setAttribute("aria-labelledby", `tab-id-${tabId}`);
  section.innerHTML = `
    <section class="overview-panel" aria-label="Översikt företag och ärende">
      <article>
        <h2>Företag</h2>
        <div id="foretagInfo-${tabId}">
          <p>(Ingen data ännu)</p>
        </div>
      </article>
      <article>
        <h2>Ärende</h2>
        <div id="arendeInfo-${tabId}">
          <p>(Ingen data ännu)</p>
        </div>
      </article>
    </section>
    <section class="task-panel">
      <h2>Ingen arbetsuppgift vald</h2>
      <p>Sök ett ärende eller lägg till data för att visa innehåll här.</p>
    </section>
  `;
  mainContentEl.appendChild(section);

  // Aktivera nya fliken
  activateTab(tabId);
  return tabId;
}

// Aktivera vald flik, inaktivera övriga
function activateTab(tabId) {
  // Avmarkera alla tabbar
  const allTabs = tabListEl.querySelectorAll(".tab-item");
  allTabs.forEach((tab) => {
    tab.classList.remove("active");
    tab.setAttribute("aria-selected", "false");
  });

  // Markera vald
  const activeLi = tabListEl.querySelector(`[data-tab-id="${tabId}"]`);
  if (activeLi) {
    activeLi.classList.add("active");
    activeLi.setAttribute("aria-selected", "true");
  }

  // Dölj alla paneler
  const allPanels = mainContentEl.querySelectorAll(".tab-panel");
  allPanels.forEach((panel) => panel.classList.add("hidden"));

  // Visa vald panel
  const activePanel = document.getElementById(`tabPanel${tabId}`);
  if (activePanel) {
    activePanel.classList.remove("hidden");
  }
}

// Hämta aktiv flik (den som är aria-selected=true)
function getActiveTabId() {
  const currentTab = tabListEl.querySelector('.tab-item.active');
  return currentTab ? currentTab.getAttribute('data-tab-id') : null;
}

// Stäng en flik
function closeTab(event, tabId) {
  event.stopPropagation(); // förhindra klick på LI
  // Ta bort flik och panel
  const li = tabListEl.querySelector(`[data-tab-id="${tabId}"]`);
  if (li) li.remove();
  const panel = document.getElementById(`tabPanel${tabId}`);
  if (panel) panel.remove();
  // Rensa data
  delete tabsData[tabId];

  // Om vi stängde den aktiva fliken, aktivera någon annan
  const stillOpenTabs = tabListEl.querySelectorAll('.tab-item:not(.new-tab)');
  if (stillOpenTabs.length > 0) {
    const firstTab = stillOpenTabs[0];
    const newActiveId = firstTab.getAttribute('data-tab-id');
    activateTab(newActiveId);
  }
}

/*******************************************************
 * Rendera data i en flik
 *******************************************************/
function renderTabPanel(tabId) {
  const data = tabsData[tabId];
  if (!data) return; // fliken finns ej

  const arendenummer = data.arendenummer;
  if (!arendenummer) {
    // Har inget ärendenummer att visa
    return;
  }

  // Hämta mock-data
  const mock = mockArenden[arendenummer];
  if (!mock) return;

  // Uppdatera flikens label
  const li = tabListEl.querySelector(`[data-tab-id="${tabId}"]`);
  if (li) {
    li.childNodes[0].textContent = `${arendenummer} REV`;
    // (du kan sätta vad du vill i rubriken – “REV”, “FÖR” etc. beroende på wireframe)
  }

  // Fyll i företag & ärende
  const foretagDiv = document.getElementById(`foretagInfo-${tabId}`);
  const arendeDiv = document.getElementById(`arendeInfo-${tabId}`);

  foretagDiv.innerHTML = `
    <p><strong>Namn:</strong> ${mock.företag.namn}</p>
    <p><strong>Org.nr:</strong> ${mock.företag.orgnr}</p>
    <p><strong>Bolagsform:</strong> ${mock.företag.bolagsform}</p>
    <!-- Exempel på extrainfo -->
    ${
      mock.företag.namn === "Telefoni AB" 
       ? `<p style="color:blue;">Fusion inledd</p>` 
       : ``
    }
  `;

  let händelserHtml = "";
  if (mock.ärende.händelser.length > 0) {
    händelserHtml = mock.ärende.händelser.map(
      (h) => `<li>${h.typ} – ${h.datum}</li>`
    ).join("");
  } else {
    händelserHtml = "<li>— (Inga händelser listade)</li>";
  }

  arendeDiv.innerHTML = `
    <p><strong>${mock.ärende.rubrik}</strong></p>
    <p>${mock.ärende.nummer}</p>
    <p>Status: ${mock.ärende.status}</p>
    <p>Händelser:</p>
    <ul>${händelserHtml}</ul>
  `;
}