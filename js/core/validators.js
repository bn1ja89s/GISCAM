export function validateProject(data) {
  const errors = [];
  const allowedSr = new Set(["WGS84_UTM_17S", "WGS84_UTM_18S"]);
  const allowedDemSourceTypes = new Set(["global", "project"]);

  if (!data.cod_exploracion?.trim()) {
    errors.push("El codigo de exploracion es obligatorio.");
  }

  if (!data.concesion_area?.trim()) {
    errors.push("La concesion o area es obligatoria.");
  }

  if (!data.tecnico?.trim()) {
    errors.push("El tecnico responsable es obligatorio.");
  }

  if (!data.sr_proyecto?.trim()) {
    errors.push("El sistema de referencia del proyecto es obligatorio.");
  }

  if (data.sr_proyecto?.trim() && !allowedSr.has(data.sr_proyecto.trim())) {
    errors.push("SR_PROYECTO debe ser WGS84_UTM_17S o WGS84_UTM_18S.");
  }

  if (data.dem_source_type?.trim() && !allowedDemSourceTypes.has(data.dem_source_type.trim())) {
    errors.push("La fuente DEM debe ser global o project.");
  }

  if (data.dem_source_type?.trim() === "project" && !data.dem_service_url?.trim()) {
    errors.push("Debes registrar la URL del DEM del proyecto cuando la fuente DEM sea especifica del proyecto.");
  }

  return errors;
}

export function validateCollar(data) {
  const errors = [];
  const allowedTipos = new Set(["POZO", "CALICATA", "CANALETA"]);

  if (!data.proyecto_uuid?.trim()) {
    errors.push("No existe un proyecto activo para asociar el collar.");
  }

  if (!data.hole_id?.trim()) {
    errors.push("El Hole ID es obligatorio.");
  }

  if (!data.fecha?.trim()) {
    errors.push("La fecha del collar es obligatoria.");
  }

  if (data.tipo?.trim() && !allowedTipos.has(data.tipo.trim())) {
    errors.push("TIPO debe ser POZO, CALICATA o CANALETA.");
  }

  if (data.latitude === "" || data.latitude === null || data.latitude === undefined) {
    errors.push("Debes capturar el punto del collar en el mapa.");
  }

  if (data.longitude === "" || data.longitude === null || data.longitude === undefined) {
    errors.push("Debes capturar el punto del collar en el mapa.");
  }

  return errors;
}

export function validateSurvey(data) {
  const errors = [];

  if (!data.collar_uuid?.trim()) {
    errors.push("Debes seleccionar un collar para el survey.");
  }

  if (data.profundidad === "" || data.profundidad === null || data.profundidad === undefined) {
    errors.push("La profundidad del survey es obligatoria.");
  }

  return errors;
}

export function validateAssay(data) {
  const errors = [];

  if (!data.collar_uuid?.trim()) {
    errors.push("Debes seleccionar un collar para el assay.");
  }

  if (!data.muestra_id?.trim()) {
    errors.push("El ID de muestra es obligatorio.");
  }

  return errors;
}

export function validateLaboratorio(data) {
  const errors = [];

  if (!data.assay_uuid?.trim()) {
    errors.push("Debes seleccionar un assay para el registro de laboratorio.");
  }

  if (!data.laboratorio?.trim()) {
    errors.push("El nombre del laboratorio es obligatorio.");
  }

  return errors;
}