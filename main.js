let xmlDoc = null;

const statusLabels = {
  created: "створено",
  transit: "у дорозі",
  delivered: "доставлено"
};

function setMessage(text, isError = false) {
  const msg = document.getElementById("message");
  msg.textContent = text;
  msg.className = isError ? "status-bar error" : "status-bar";
}

function validateStructure(doc) {
  if (!doc || doc.documentElement.tagName !== "deliveryService") {
    throw new Error("Невірний кореневий елемент: очікується <deliveryService>.");
  }
  const shipments = doc.getElementsByTagName("shipment");
  if (shipments.length === 0) {
    throw new Error("Документ не містить жодного елемента <shipment>.");
  }
  const requiredFields = ["trackingNumber", "senderCity", "recipientCity", "weightKg", "deliveryCost", "sentDate"];
  for (const s of shipments) {
    if (!s.getAttribute("id") || !s.getAttribute("status")) {
      throw new Error("У записі <shipment> відсутній обов'язковий атрибут id або status.");
    }
    for (const f of requiredFields) {
      if (!s.querySelector(f)) {
        throw new Error(`У записі ${s.getAttribute("id")} відсутнє обов'язкове поле <${f}>.`);
      }
    }
  }
}

function renderTable() {
  const tbody = document.getElementById("rows");
  const summaryEl = document.getElementById("summary");
  tbody.replaceChildren();

  const cityFilter = document.getElementById("filterCity").value.trim().toLowerCase();
  const statusFilter = document.getElementById("filterStatus").value;
  const sortOrder = document.getElementById("sortOrder").value;

  let records = Array.from(xmlDoc.getElementsByTagName("shipment")).map(node => ({
    node,
    id: node.getAttribute("id"),
    status: node.getAttribute("status"),
    tracking: node.querySelector("trackingNumber").textContent.trim(),
    sender: node.querySelector("senderCity").textContent.trim(),
    recipient: node.querySelector("recipientCity").textContent.trim(),
    weight: parseFloat(node.querySelector("weightKg").textContent.trim()),
    cost: parseFloat(node.querySelector("deliveryCost").textContent.trim()),
    date: node.querySelector("sentDate").textContent.trim(),
    note: node.querySelector("note") ? node.querySelector("note").textContent.trim() : "—"
  }));

  if (cityFilter) {
    records = records.filter(r => r.recipient.toLowerCase().includes(cityFilter));
  }
  if (statusFilter !== "all") {
    records = records.filter(r => r.status === statusFilter);
  }

  records.sort((a, b) => sortOrder === "asc"
    ? a.date.localeCompare(b.date)
    : b.date.localeCompare(a.date));

  if (records.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 9;
    td.style.textAlign = "center";
    td.textContent = "За заданими умовами відбору відправлень не знайдено.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    summaryEl.textContent = "Підсумки: вибірка порожня (0 записів).";
    return;
  }

  let totalWeight = 0;
  let totalCost = 0;

  for (const r of records) {
    totalWeight += r.weight;
    totalCost += r.cost;

    const tr = document.createElement("tr");

    const cells = [
      r.id,
      r.tracking,
      `${r.sender} → ${r.recipient}`,
      r.weight.toFixed(2),
      r.cost.toFixed(2),
      r.date
    ];

    for (const val of cells) {
      const td = document.createElement("td");
      td.textContent = val;
      tr.appendChild(td);
    }

    const tdStatus = document.createElement("td");
    const span = document.createElement("span");
    span.className = `badge badge-${r.status}`;
    span.textContent = statusLabels[r.status] || r.status;
    tdStatus.appendChild(span);
    tr.appendChild(tdStatus);

    const tdNote = document.createElement("td");
    tdNote.textContent = r.note;
    tr.appendChild(tdNote);

    const tdAction = document.createElement("td");
    const delBtn = document.createElement("button");
    delBtn.textContent = "Видалити";
    delBtn.className = "danger";
    delBtn.onclick = () => deleteShipment(r.id);
    tdAction.appendChild(delBtn);
    tr.appendChild(tdAction);

    tbody.appendChild(tr);
  }

  summaryEl.textContent = `Підсумки вибірки (${records.length} відправлень): сумарна вага = ${totalWeight.toFixed(2)} кг | загальна вартість доставки = ${totalCost.toFixed(2)} грн`;
}

function deleteShipment(id) {
  const all = xmlDoc.getElementsByTagName("shipment");
  if (all.length <= 1) {
    setMessage("Неможливо видалити останній запис (схема вимагає мінімум 1 елемент shipment).", true);
    return;
  }
  const target = Array.from(all).find(s => s.getAttribute("id") === id);
  if (target && target.parentNode) {
    target.parentNode.removeChild(target);
    renderTable();
    setMessage(`Відправлення ${id} видалено з дерева XML DOM.`);
  }
}

document.getElementById("updateBtn").addEventListener("click", () => {
  const id = document.getElementById("editId").value.trim();
  const costVal = parseFloat(document.getElementById("editCost").value);
  const newStatus = document.getElementById("editStatus").value;

  const target = Array.from(xmlDoc.getElementsByTagName("shipment"))
    .find(s => s.getAttribute("id") === id);

  if (!target) {
    setMessage(`Помилка: відправлення з ID "${id}" не знайдено.`, true);
    return;
  }
  if (isNaN(costVal) || costVal < 0) {
    setMessage("Помилка: вартість доставки має бути невід'ємним числом.", true);
    return;
  }

  target.querySelector("deliveryCost").textContent = costVal.toFixed(2);
  target.setAttribute("status", newStatus);
  renderTable();
  setMessage(`Дані відправлення ${id} успішно оновлено.`);
});

document.getElementById("addBtn").addEventListener("click", () => {
  const id = document.getElementById("newId").value.trim();
  const tracking = document.getElementById("newTracking").value.trim();
  const sender = document.getElementById("newSender").value.trim();
  const recipient = document.getElementById("newRecipient").value.trim();
  const weight = parseFloat(document.getElementById("newWeight").value);
  const cost = parseFloat(document.getElementById("newCost").value);
  const date = document.getElementById("newDate").value;
  const status = document.getElementById("newStatus").value;
  const note = document.getElementById("newNote").value.trim();

  if (!/^[A-Za-z_][\w.-]*$/.test(id)) {
    setMessage("Помилка: ID повинен починатися з літери (наприклад, S010).", true);
    return;
  }
  if (!/^\d{12}$/.test(tracking)) {
    setMessage("Помилка: трек-номер повинен містити рівно 12 цифр.", true);
    return;
  }
  if (!sender || !recipient || !date) {
    setMessage("Помилка: заповніть міста відправника, одержувача та дату.", true);
    return;
  }
  if (isNaN(weight) || weight <= 0 || weight > 100) {
    setMessage("Помилка: вага має бути в межах (0; 100] кг.", true);
    return;
  }
  if (isNaN(cost) || cost < 0) {
    setMessage("Помилка: вартість має бути невід'ємним числом.", true);
    return;
  }

  const existing = Array.from(xmlDoc.getElementsByTagName("shipment"));
  if (existing.some(s => s.getAttribute("id") === id)) {
    setMessage(`Помилка: ідентифікатор ${id} вже існує!`, true);
    return;
  }
  if (existing.some(s => s.querySelector("trackingNumber").textContent.trim() === tracking)) {
    setMessage(`Помилка: трек-номер ${tracking} вже існує в реєстрі!`, true);
    return;
  }

  const shipmentsNode = xmlDoc.querySelector("shipments");
  const shipment = xmlDoc.createElement("shipment");
  shipment.setAttribute("id", id);
  shipment.setAttribute("status", status);

  const fields = {
    trackingNumber: tracking,
    senderCity: sender,
    recipientCity: recipient,
    weightKg: weight.toFixed(2),
    deliveryCost: cost.toFixed(2),
    sentDate: date
  };

  for (const [tag, val] of Object.entries(fields)) {
    const el = xmlDoc.createElement(tag);
    el.appendChild(xmlDoc.createTextNode(val));
    shipment.appendChild(el);
  }

  if (note) {
    const noteEl = xmlDoc.createElement("note");
    noteEl.appendChild(xmlDoc.createTextNode(note));
    shipment.appendChild(noteEl);
  }

  shipmentsNode.appendChild(shipment);
  renderTable();
  setMessage(`Нове відправлення ${id} (${tracking}) додано до реєстру.`);
});

document.getElementById("applyFilterBtn").addEventListener("click", renderTable);
document.getElementById("resetFilterBtn").addEventListener("click", () => {
  document.getElementById("filterCity").value = "";
  document.getElementById("filterStatus").value = "all";
  document.getElementById("sortOrder").value = "asc";
  renderTable();
});

document.getElementById("exportBtn").addEventListener("click", () => {
  const serialized = new XMLSerializer().serializeToString(xmlDoc);
  const blob = new Blob([serialized], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "result.xml";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setMessage("Експортовано файл result.xml.");
});

document.getElementById("xmlFileInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const doc = parseXML(await file.text());
    validateStructure(doc);
    xmlDoc = doc;
    renderTable();
    setMessage(`Успішно завантажено файл ${file.name}.`);
  } catch (err) {
    setMessage(err.message, true);
  }
});

async function init() {
  try {
    xmlDoc = await loadXMLDoc("data.xml");
    validateStructure(xmlDoc);
    renderTable();
    setMessage("Файл data.xml успішно завантажено та перевірено.");
  } catch (err) {
    setMessage(err.message, true);
  }
}

document.getElementById("reloadBtn").addEventListener("click", init);
init();
