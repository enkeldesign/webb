/* script.js
   Här kombinerar vi:
   1) Flikhantering (öppna/stäng/växla).
   2) Mockade ärenden med styrelsedata (R654321/24) 
      samt ärende utan styrelsedata (R4321/24).
   3) Funktionalitet för att “Ändra företrädare” – 
      lägga till person, ta bort, ångra, spara (visuell bekräftelse).
*/

/*******************************************************
 * 1) Mockad data för ärenden
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
    },
    // Här finns redan några styrelseposter
    styrelse: [{
        personnummer: "810203-0145",
        namn: "Persson, Johanna",
        ort: "FARSTA",
        roll: "Styrelseordförande",
        status: ""
      },
      {
        personnummer: "851214-1750",
        namn: "Smith, Lars-Olov Knut",
        ort: "FARSTA",
        roll: "Styrelseledamot",
        status: ""
      },
      {
        personnummer: "850101-1573",
        namn: "Kahn, Kristoffer Karl Ossian",
        ort: "FARSTA",
        roll: "Styrelseledamot",
        status: ""
      }
    ]
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
    },
    // Ingen styrelse definierad från början
    styrelse: []
  }
};

/*******************************************************
 * 2) Global bokföring av vilka flikar som finns
 *    - Varje flik har ex.:
 *       {
 *         arendenummer: "R654321/24",
 *         hasChanges: false
 *       }
 *******************************************************/
let tabCounter = 1; // Vi har redan en flik #1
const tabsData = {
  "1": {
    arendenummer: "R654321/24",
    hasChanges: false
  }
};

/*******************************************************
 * 3) Globala variabler/DOM-referenser (flikarna, modalen m.m.)
 *******************************************************/
const tabListEl = document.getElementById("tabList");
const mainContentEl = document.getElementById("mainContent");
const globalSearchInput = document.getElementById("globalSearchInput");
const openTabSelect = document.getElementById("openTabSelect");
const globalFetchBtn = document.getElementById("globalFetchBtn");
const addTabBtn = document.getElementById("addTabBtn");

// Modal & person-lägg-till
const modalOverlay = document.getElementById("modalOverlay");
const personNummerInput = document.getElementById("personNummerInput");
const personDataArea = document.getElementById("personDataArea");
const fetchedPersonNameEl = document.getElementById("fetchedPersonName");
const fetchPersonBtn = document.getElementById("fetchPersonBtn");
const sparaBtn = document.getElementById("sparaBtn");
const avbrytBtn = document.getElementById("avbrytBtn");

// Bekräftelseruta
const confirmationBar = document.getElementById("confirmationBar");

/*******************************************************
 * 4) “Backend-sökning” av personnummer (mock)
 *******************************************************/
function fetchPersonDataMock(personnummer) {
  // Säg att vi bara hittar "19710913-7846"
  if (personnummer === "19710913-7846") {
    return {
      personnummer: "19710913-7846",
      namn: "Fastén, Samira"
    };
  }
  return null;
}

/*******************************************************
 * 5) Init
 *******************************************************/
window.addEventListener("DOMContentLoaded", () => {
  addTabBtn.addEventListener("click", () => createNewTab());
  globalFetchBtn.addEventListener("click", handleGlobalSearch);

  // Hämta referenser till knappar för flik #1 (vi har redan en panel #1)
  wireUpTabPanel("1");

  // Fyll flik #1 med data
  renderTabPanel("1");
});

/*******************************************************
 * 6) Flik-hantering: Skapa, aktivera, stäng
 *******************************************************/
function createNewTab() {
  tabCounter++;
  const tabId = tabCounter.toString();

  // Registrera default-data (ingen ärende vald, inga changes ännu)
  tabsData[tabId] = {
    arendenummer: null,
    hasChanges: false
  };

  // Skapa flik (LI)
  const li = document.createElement("li");
  li.className = "tab-item";
  li.setAttribute("data-tab-id", tabId);
  li.setAttribute("role", "tab");
  li.setAttribute("aria-selected", "false");
  li.id = `tab-id-${tabId}`;
  li.textContent = "Ny flik";

  // Stäng-knapp
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "close-tab-btn";
  closeBtn.textContent = "×";
  closeBtn.setAttribute("aria-label", "Stäng denna flik");
  closeBtn.onclick = (e) => closeTab(e, tabId);
  li.appendChild(closeBtn);

  // Infoga före “plus”-knappen
  const plusTab = tabListEl.querySelector(".new-tab");
  tabListEl.insertBefore(li, plusTab);

  // Skapa panel-element
  const section = document.createElement("section");
  section.id = `tabPanel${tabId}`;
  section.className = "tab-panel hidden";
  section.setAttribute("role", "tabpanel");
  section.setAttribute("aria-labelledby", `tab-id-${tabId}`);

  // En enklare variant av “overview” + “task-panel”
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
      <h2>Ändra företrädare / firmateckning</h2>
      <button 
        id="fetchUppgiftBtn-${tabId}" 
        type="button" 
        class="fetch-uppgift-btn"
      >
        Hämta ny arbetsuppgift
      </button>
      <section class="styrelse-section">
        <h3>Styrelse</h3>
        <div id="styrelseData-${tabId}"></div>
        <button 
          id="showAddModalBtn-${tabId}" 
          type="button" 
          class="show-add-modal-btn"
        >
          Lägg till företrädare
        </button>
      </section>
      <div class="save-area">
        <span id="noChangesText-${tabId}">Inga ändringar att spara.</span>
        <button 
          id="klarBtn-${tabId}" 
          type="button" 
          class="klar-btn"
        >
          Klar
        </button>
      </div>
    </section>
  `;
  mainContentEl.appendChild(section);

  // Koppla händelser till knappar i nya panelen
  wireUpTabPanel(tabId);

  // Aktivera fliken
  activateTab(tabId);

  return tabId;
}

function activateTab(tabId) {
  // Avmarkera alla
  const allTabs = tabListEl.querySelectorAll(".tab-item");
  allTabs.forEach((tab) => {
    tab.classList.remove("active");
    tab.setAttribute("aria-selected", "false");
  });

  // Markera den aktuella
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

function closeTab(event, tabId) {
  event.stopPropagation();
  const li = tabListEl.querySelector(`[data-tab-id="${tabId}"]`);
  if (li) li.remove();
  const panel = document.getElementById(`tabPanel${tabId}`);
  if (panel) panel.remove();
  delete tabsData[tabId];

  // Om vi stängde den aktiva fliken, öppna en annan
  const stillOpenTabs = tabListEl.querySelectorAll('.tab-item:not(.new-tab)');
  if (stillOpenTabs.length > 0) {
    const firstTab = stillOpenTabs[0];
    const newActiveId = firstTab.getAttribute('data-tab-id');
    activateTab(newActiveId);
  }
}

/*******************************************************
 * 7) Hämta aktiv flik / wireUpTabPanel
 *******************************************************/
function getActiveTabId() {
  const currentTab = tabListEl.querySelector('.tab-item.active');
  return currentTab ? currentTab.getAttribute('data-tab-id') : null;
}

/* 
   wireUpTabPanel kopplar de händelsehanterare som finns i 
   en given flik (ex. "Klar"-knappen, "Lägg till företrädare").
*/
function wireUpTabPanel(tabId) {
  // Hämta knappar
  const fetchUppgiftBtn = document.getElementById(`fetchUppgiftBtn-${tabId}`);
  const showAddModalBtn = document.getElementById(`showAddModalBtn-${tabId}`);
  const klarBtn = document.getElementById(`klarBtn-${tabId}`);

  if (fetchUppgiftBtn) {
    fetchUppgiftBtn.addEventListener("click", () => {
      alert("Hämta ny arbetsuppgift (mock) – inget extra händer just nu.");
    });
  }

  if (showAddModalBtn) {
    showAddModalBtn.addEventListener("click", () => openAddPersonModal(tabId));
  }

  if (klarBtn) {
    klarBtn.addEventListener("click", () => handleKlar(tabId));
  }
}

/*******************************************************
 * 8) Global sökning (“R654321/24” eller “R4321/24”)
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
    if (!activeTabId) {
      // Finns ingen flik? Skapa en ny då.
      const newId = createNewTab();
      tabsData[newId].arendenummer = searchTerm;
      renderTabPanel(newId);
      activateTab(newId);
    } else {
      tabsData[activeTabId].arendenummer = searchTerm;
      tabsData[activeTabId].hasChanges = false;
      renderTabPanel(activeTabId);
    }
  } else {
    // "new" – öppna i ny flik
    const newId = createNewTab();
    tabsData[newId].arendenummer = searchTerm;
    renderTabPanel(newId);
    activateTab(newId);
  }
}

/*******************************************************
 * 9) Rendera innehåll i en flik: Företag, ärende, styrelse
 *******************************************************/
function renderTabPanel(tabId) {
  const data = tabsData[tabId];
  if (!data) return;
  const arendenummer = data.arendenummer;
  if (!arendenummer) {
    // Ingen data att visa
    return;
  }

  // Hämta mock
  const mock = mockArenden[arendenummer];
  if (!mock) return;

  // Uppdatera flikens rubrik
  const li = tabListEl.querySelector(`[data-tab-id="${tabId}"]`);
  if (li) {
    // Exempel: “R4321/24 REV” eller “R654321/24 FÖR”
    // Du väljer själv suffix (REV / FÖR). Här sätter vi “REV” för exemplet.
    li.childNodes[0].textContent = `${arendenummer} REV`;
  }

  // Skriv företag
  const foretagDiv = document.getElementById(`foretagInfo-${tabId}`);
  foretagDiv.innerHTML = `
    <p><strong>Namn:</strong> ${mock.företag.namn}</p>
    <p><strong>Org.nr:</strong> ${mock.företag.orgnr}</p>
    <p><strong>Bolagsform:</strong> ${mock.företag.bolagsform}</p>
    ${
      mock.företag.namn === "Telefoni AB"
        ? `<p style="color:blue;">Fusion inledd</p>`
        : ``
    }
  `;

  // Skriv ärende
  const arendeDiv = document.getElementById(`arendeInfo-${tabId}`);
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

  // Skriv styrelse
  renderStyrelse(tabId);
}

/*******************************************************
 * 10) Rendera styrelse för en viss flik
 *******************************************************/
function renderStyrelse(tabId) {
  const data = tabsData[tabId];
  if (!data || !data.arendenummer) return;

  const mock = mockArenden[data.arendenummer];
  if (!mock) return;

  const styrelse = mock.styrelse;
  const styrelseDataEl = document.getElementById(`styrelseData-${tabId}`);

  // Dela upp i ordf, led, supp
  const ordf = styrelse.filter(p => p.roll === "Styrelseordförande");
  const led = styrelse.filter(p => p.roll === "Styrelseledamot");
  const supp = styrelse.filter(p => p.roll === "Styrelsesuppleant");

  let html = "";
  if (ordf.length > 0) {
    html += `<h4>Styrelseordförande</h4>`;
    ordf.forEach(person => {
      html += renderPersonRow(tabId, person);
    });
  }
  if (led.length > 0) {
    html += `<h4>Styrelseledamöter</h4>`;
    led.forEach(person => {
      html += renderPersonRow(tabId, person);
    });
  }
  if (supp.length > 0) {
    html += `<h4>Styrelsesuppleanter</h4>`;
    supp.forEach(person => {
      html += renderPersonRow(tabId, person);
    });
  }

  styrelseDataEl.innerHTML = html || "<p>Inga företrädare.</p>";
}

function renderPersonRow(tabId, person) {
  // om person.status = "Borttagen" -> röd bakgrund
  // om person.status = "NY" -> grön bakgrund
  let rowStyle = "";
  const pStatus = person.status.toLowerCase();
  if (pStatus === "borttagen" || pStatus.startsWith("borttagen")) {
    rowStyle = 'style="background-color: #ffe5e5;"';
  } else if (pStatus === "ny" || pStatus.startsWith("ny")) {
    rowStyle = 'style="background-color: #e5ffe5;"';
  }

  return `
    <div class="person-row" ${rowStyle}>
      <span>${person.personnummer} – ${person.namn}, ${person.ort} 
           <em>${person.status}</em>
      </span>
      ${
        pStatus === "borttagen"
          ? `<button 
               type="button"
               onclick="undoRemove('${tabId}','${person.personnummer}')"
             >
               Ångra
             </button>`
          : `<button 
               type="button"
               onclick="removePerson('${tabId}','${person.personnummer}')"
             >
               Ta bort
             </button>`
      }
    </div>
  `;
}

/*******************************************************
 * 11) Öppna modal för “Lägg till person”
 *******************************************************/
function openAddPersonModal(tabId) {
  // Spara vilket tabId som är "mål" i en dataset-prop
  modalOverlay.dataset.tabId = tabId;

  // Nollställ fält
  personNummerInput.value = "";
  personDataArea.classList.add("hidden");
  fetchedPersonNameEl.textContent = "";
  sparaBtn.disabled = true;

  // Visa
  modalOverlay.classList.remove("hidden");
}

/*******************************************************
 * 12) Hämta person (i modalen) + Spara
 *******************************************************/
fetchPersonBtn.addEventListener("click", () => {
  const pnr = personNummerInput.value.trim();
  if (!pnr) {
    alert("Fyll i personnummer först.");
    return;
  }

  const personData = fetchPersonDataMock(pnr);
  if (personData) {
    // Visa info i modalen
    personDataArea.classList.remove("hidden");
    fetchedPersonNameEl.textContent = personData.namn;
    sparaBtn.disabled = false;
  } else {
    alert("Kunde inte hitta person med angivet personnummer.");
  }
});

// När man klickar “Spara” i modalen
sparaBtn.addEventListener("click", (e) => {
  e.preventDefault();
  const tabId = modalOverlay.dataset.tabId;
  if (!tabId) {
    alert("Ingen flik vald, oväntat fel.");
    return;
  }
  // Hämta data
  const pnr = personNummerInput.value.trim();
  const name = fetchedPersonNameEl.textContent;
  const ortInput = document.getElementById("postOrtInput").value.trim() || "Okänd ort";

  // Vilka roller är ikryssade?
  const formEl = document.getElementById("addPersonForm");
  const roller = Array.from(formEl.querySelectorAll('input[name="roller"]:checked'))
    .map(checkbox => checkbox.value);

  if (roller.length === 0) {
    alert("Minst en roll måste väljas.");
    return;
  }

  // Lägg till en post per roll i mockArenden
  const data = tabsData[tabId];
  if (!data.arendenummer) {
    alert("Ingen ärendedata i denna flik, öppna ett ärende först.");
    return;
  }
  const mock = mockArenden[data.arendenummer];
  if (!mock) {
    alert("Kunde ej hitta ärende i mock-databasen.");
    return;
  }

  roller.forEach(roll => {
    mock.styrelse.push({
      personnummer: pnr,
      namn: name,
      ort: ortInput,
      roll: roll,
      status: "NY"
    });
  });

  // Markera ändring i denna flik
  data.hasChanges = true;
  const noChangesEl = document.getElementById(`noChangesText-${tabId}`);
  noChangesEl.textContent = "Ändringar har gjorts.";

  // Stäng modalen
  closeModal();

  // Rendera styrelse igen
  renderStyrelse(tabId);
});

/*******************************************************
 * 13) Ta bort / Ångra
 *******************************************************/
function removePerson(tabId, pnr) {
  const data = tabsData[tabId];
  if (!data.arendenummer) return;
  const mock = mockArenden[data.arendenummer];
  const person = mock.styrelse.find(p => p.personnummer === pnr);
  if (person) {
    person.status = "Borttagen";
    data.hasChanges = true;
    document.getElementById(`noChangesText-${tabId}`).textContent = "Ändringar har gjorts.";
    renderStyrelse(tabId);
  }
}

function undoRemove(tabId, pnr) {
  const data = tabsData[tabId];
  if (!data.arendenummer) return;
  const mock = mockArenden[data.arendenummer];
  const person = mock.styrelse.find(p => p.personnummer === pnr);
  if (person) {
    person.status = "";
    data.hasChanges = true;
    document.getElementById(`noChangesText-${tabId}`).textContent = "Ändringar har gjorts.";
    renderStyrelse(tabId);
  }
}

/*******************************************************
 * 14) Stäng modal
 *******************************************************/
avbrytBtn.addEventListener("click", closeModal);

function closeModal() {
  modalOverlay.classList.add("hidden");
}

/*******************************************************
 * 15) Klick på “Klar” – spara ändringar
 *******************************************************/
function handleKlar(tabId) {
  const data = tabsData[tabId];
  if (!data) return;
  if (!data.hasChanges) {
    alert("Inga ändringar att spara.");
    return;
  }

  // “Spara” i mock – vi markerar NY -> “NY (sparad)” och Borttagen -> “Borttagen (sparad)”
  const mock = mockArenden[data.arendenummer];
  mock.styrelse.forEach(p => {
    const st = p.status.toLowerCase();
    if (st === "ny") {
      p.status = "NY (sparad)";
    } else if (st === "borttagen") {
      p.status = "Borttagen (sparad)";
    }
  });

  // Bekräftelseruta
  confirmationBar.classList.remove("hidden");
  setTimeout(() => {
    confirmationBar.classList.add("hidden");
  }, 3000);

  // Återställ
  data.hasChanges = false;
  document.getElementById(`noChangesText-${tabId}`).textContent = "Inga ändringar att spara.";
  renderStyrelse(tabId);
}