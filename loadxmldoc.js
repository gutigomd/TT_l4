function parseXML(text) {
  const xmlDoc = new DOMParser().parseFromString(text, "application/xml");
  if (xmlDoc.querySelector("parsererror")) {
    throw new Error("Помилка синтаксису XML-документа.");
  }
  return xmlDoc;
}

async function loadXMLDoc(fileName) {
  const response = await fetch(fileName);
  if (!response.ok) {
    throw new Error(`Помилка завантаження файлу ${fileName}: HTTP ${response.status}`);
  }
  return parseXML(await response.text());
}
