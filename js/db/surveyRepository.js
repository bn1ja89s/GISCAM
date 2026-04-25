import { addRecord, deleteRecord, getAllRecords, getRecordByIndex, getRecordsByIndex, putRecord } from "./indexeddb.js";
import { sortByDate } from "../core/helpers.js";

const STORE = "surveys";

export async function listSurveys() {
  return sortByDate(await getAllRecords(STORE));
}

export function getSurveyByUuid(uuid) {
  return getRecordByIndex(STORE, "uuid", uuid);
}

export function listSurveysByCollar(collarUuid) {
  return getRecordsByIndex(STORE, "collar_uuid", collarUuid);
}

export async function saveSurvey(survey) {
  if (survey.id_local) {
    await putRecord(STORE, survey);
    return survey;
  }

  const idLocal = await addRecord(STORE, survey);
  return { ...survey, id_local: idLocal };
}

export function deleteSurveyByLocalId(idLocal) {
  return deleteRecord(STORE, idLocal);
}