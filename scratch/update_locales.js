const fs = require('fs');

const updatesES = {
    "cat_emails": { "description": "Category name for Emails.", "message": "Correos y Contactos" },
    "cat_diagrams": { "description": "Category name for Diagrams.", "message": "Diagramas y Flujos" },
    "cat_databases": { "description": "Category name for Databases.", "message": "Bases de Datos" },
    "cat_certificates": { "description": "Category name for Certificates.", "message": "Certificados y Seguridad" },
    "cat_templates": { "description": "Category name for Templates.", "message": "Plantillas de Oficina" },
    "cat_cad": { "description": "Category name for CAD.", "message": "CAD y Planos" },
    "folder_emails": { "description": "Default folder for emails.", "message": "Correos_y_Contactos" },
    "folder_diagrams": { "description": "Default folder for diagrams.", "message": "Diagramas" },
    "folder_databases": { "description": "Default folder for databases.", "message": "Bases_de_Datos" },
    "folder_certificates": { "description": "Default folder for certificates.", "message": "Certificados" },
    "folder_templates": { "description": "Default folder for templates.", "message": "Plantillas" },
    "folder_cad": { "description": "Default folder for cad.", "message": "CAD_y_Planos" }
};

const updatesEN = {
    "cat_emails": { "description": "Category name for Emails.", "message": "Emails & Contacts" },
    "cat_diagrams": { "description": "Category name for Diagrams.", "message": "Diagrams & Workflows" },
    "cat_databases": { "description": "Category name for Databases.", "message": "Databases" },
    "cat_certificates": { "description": "Category name for Certificates.", "message": "Certificates & Security" },
    "cat_templates": { "description": "Category name for Templates.", "message": "Office Templates" },
    "cat_cad": { "description": "Category name for CAD.", "message": "CAD & Engineering" },
    "folder_emails": { "description": "Default folder for emails.", "message": "Emails_Contacts" },
    "folder_diagrams": { "description": "Default folder for diagrams.", "message": "Diagrams" },
    "folder_databases": { "description": "Default folder for databases.", "message": "Databases" },
    "folder_certificates": { "description": "Default folder for certificates.", "message": "Certificates" },
    "folder_templates": { "description": "Default folder for templates.", "message": "Templates" },
    "folder_cad": { "description": "Default folder for cad.", "message": "CAD_Files" }
};

function updateFile(file, updates) {
    let data = JSON.parse(fs.readFileSync(file, 'utf8'));
    Object.assign(data, updates);
    fs.writeFileSync(file, JSON.stringify(data, null, 4));
}

updateFile('_locales/es/messages.json', updatesES);
updateFile('_locales/en/messages.json', updatesEN);
console.log("Locales updated");
