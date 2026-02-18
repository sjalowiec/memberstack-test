<!--- <cfdump var="#form#"> --->

<CFQUERY NAME="update"  DATASOURCE="patternengine">
update Glossary
set Image_description = <cfqueryparam cfsqltype="CF_SQL_VARCHAR" value="#form.Image_description#">,
Image_alt = <cfqueryparam cfsqltype="CF_SQL_VARCHAR" value="#form.Image_alt#">,
MetaTitle = <cfqueryparam cfsqltype="CF_SQL_VARCHAR" value="#form.MetaTitle#">,
Metadescription = <cfqueryparam cfsqltype="CF_SQL_VARCHAR" value="#form.Metadescription#">
where GlossaryId = <cfqueryparam cfsqltype="CF_SQL_INTEGER" value="#form.GLOSSARYID#">
</CFQUERY>

<div class="alert alert-success">Updated text Meta Data</div>

<cfif len(form.NEWIMAGENAM) gt 3>
<cfdirectory action="LIST" directory="C:\home\knititnow.com\wwwroot\images\glossary" name="currentimages" filter="*.jpg|*.png|*.gif|*.jpge|*.webp|*.jpeg">

<!--- check if the image exist --->
<cfquery name="checkname" dbtype="query">
select *
from currentimages
where name = <cfqueryparam cfsqltype="CF_SQL_VARCHAR" value="#form.NEWIMAGENAM#">
</cfquery>

<cfif checkname.recordcount gt 0>
	<div class="alert alert-warning">Did not modify file since this file current exist <strong><cfoutput>#form.NEWIMAGENAM#</cfoutput></strong></div>
	<cfabort>
</cfif>

<!--- <CFQUERY NAME="update"  DATASOURCE="patternengine">
update Glossary
set image = <cfqueryparam cfsqltype="CF_SQL_VARCHAR" value="/images/glossary/#form.NEWIMAGENAM#">
where GlossaryId = <cfqueryparam cfsqltype="CF_SQL_INTEGER" value="#form.GLOSSARYID#">
</CFQUERY>
<div class="alert alert-success">Update image name and location to: <strong><cfoutput>#form.NEWIMAGENAM#</cfoutput></strong></div> --->
</cfif>