function isLegacyAdministrator(role){return typeof role==='string'&&role.trim().toLowerCase()==='admin';}
module.exports={isLegacyAdministrator};
