<cfoutput>

<!--- get sleeve cap --->
				<CFQUERY NAME="leghtgetsectionmesurement"  DATASOURCE="patternengine">
				select 	a.EngineVariable,
						m.Memsurement
				from 	Sizing_mesurments m,
						Sizing_areas a
				where	a.SizingAreaId = m.SizingAreaId_FK and
						m.sizingtypeid_fk = #garment.sizingtypeid_fk# and
						m.SizingSizeID_fk = <cfqueryparam cfsqltype="CF_SQL_INTEGER" value="#form.SizingSizeID#"> and
						a.EngineVariable = <cfqueryparam cfsqltype="CF_SQL_VARCHAR" value="sleeve_cap">
						
					</CFQUERY>
					<cfif form.debug eq 1>
						<cfdump var="#leghtgetsectionmesurement#">
					</cfif>
					<Cfset sleevecap_inches = leghtgetsectionmesurement.Memsurement>
					
					<cfset sleevecap_stitches = int(sleevecap_inches*stitchgauge)> <!--- item 10 --->
					
					<cfif BitAnd(sleevecap_stitches, 1 )>
						<cfset sleevecap_stitches = sleevecap_stitches + 1> <!--- make this also odd --->
					</cfif>
		 			
<!--- END get sleeve cap --->		

<!--- setinsleeve_armholewidth passed from other pieace --->

<cfset "pattern_#actionid#_details" = structnew()>
<cfset "pattern_#actionid#_details.type" = "Setinsleave">
<cfset "pattern_#actionid#_details.startrow" = rowcount>
<cfset "pattern_#actionid#_details.Mulipler" = Mulipler>
<cfset "pattern_#actionid#_details.sleevecap_inches" = sleevecap_inches>
<cfset "pattern_#actionid#_details.stitchcount" = stitchcount>
<cfset "pattern_#actionid#_details.showelement" = "Sleeve Cap">
<cfset "pattern_#actionid#_details.includeinpattern" = 1>

<!--- set this to the pattern level to use in the collenctions --->
<cfset "pattern_#patternid_fk#.underarmMarkerRows" = rowcount>

<Cfset sleevecap_endheight = 0>	

<!--- calucalte sleave cap inches --->
	<!--- step 4 --->
((#stitchcount#/#stitchgauge#)/4) - .25
<cfset Final_bind_Off_inches = ((stitchcount/stitchgauge)/4) - .25>
Final_bind_Off_inches = #Final_bind_Off_inches#
<cfset Final_bind_off_stitches = int(Final_bind_Off_inches * stitchgauge)>

<cfif BitAnd(Final_bind_off_stitches, 1 )>
		<cfset Final_bind_off_stitches = Final_bind_off_stitches - 1> <!--- make this also odd --->
</cfif>
Final_bind_off_stitches = #Final_bind_off_stitches#

	<!--- step 3 (top slope)--->
Top_slope_rows = int(#rowgauge# /2)
<Cfset Top_slope_rows = int(rowgauge /2)>
<cfif BitAnd(Top_slope_rows, 1 )>
		<cfset Top_slope_rows = Top_slope_rows + 1> <!--- make this also odd --->
</cfif>
Top_slope_rows = #Top_slope_rows#<br>

<cfset Top_slope_decrease1 = int((stitchgauge*2)/Top_slope_rows)>
<cfset Top_slope_decrease2 = int(stitchgauge - Top_slope_decrease1)>
<cfif Top_slope_decrease2 gt Top_slope_decrease1>
	<cfset Top_slope_decrease2 = Top_slope_decrease1>
	<Cfset Top_slope_decrease3 = int(stitchgauge - Top_slope_decrease1 - Top_slope_decrease2)>
<cfelse>
	<Cfset Top_slope_decrease3 = 0>
</cfif>


Top_slope_decrease1 = #Top_slope_decrease1#<br>
Top_slope_decrease2 = #Top_slope_decrease2#<br>
Top_slope_decrease3 = #Top_slope_decrease3#
<cfif Top_slope_decrease3 lt 0>
	<cfset Top_slope_decrease3 = 0>
</cfif>
<cfset topslopelist = Top_slope_decrease1>
<Cfset topslopelist = listappend(topslopelist,Top_slope_decrease2)>
<Cfset topslopelist = listappend(topslopelist,Top_slope_decrease3)>

<cfset topsloperowlist = listsort(topslopelist, "numeric", "asc", ",")/>
<br>topsloperowlist = #topsloperowlist#<br>

<!--- set the top slope in inchs --->
<cfset topslope_width_inch = (Top_slope_decrease1 + Top_slope_decrease2 + Top_slope_decrease3)/stitchgauge> <!--- always ONE INCH (per sue) --->
<cfset topslope_height_inch = Top_slope_rows/rowgauge>

<cfset topslope_slope_inch = sqr((topslope_width_inch*topslope_width_inch) + (topslope_height_inch*topslope_height_inch))>
<br>topslope_slope_inch = #topslope_slope_inch#<br>

<cfset sleave_intialbindoff_inches = sleaveinsleave_armholestep1/sleaveinsleave_bodystichgauge>
sleave_intialbindoff_inches = #sleave_intialbindoff_inches#<br>
<br>
<br>
<Cfset workingwitdh_stitches = (stitchcount/2) - sleaveinsleave_armholestep1 - Top_slope_decrease1 - Top_slope_decrease2 - Top_slope_decrease3 - Final_bind_off_stitches/2>
workingwitdh_stitches = #workingwitdh_stitches#  = (#stitchcount#/2) - #sleaveinsleave_armholestep1# - #Top_slope_decrease1# - #Top_slope_decrease2# - #Top_slope_decrease3# - #Final_bind_off_stitches#/2<br>
<Cfset workingwitdh_inches = workingwitdh_stitches/stitchgauge>
workingwitdh_inches = #workingwitdh_inches#<br>

<!--- get parmater --->
<cfset Zone_1_lenght_in = sleaveinsleave_armholestep1/sleaveinsleave_bodystichgauge>
<cfset Zone_1_height_in = 0>
<cfset Zone_1_bind_lenght = sqr((Zone_1_lenght_in*Zone_1_lenght_in))>
Zone_1_lenght_in = #sleaveinsleave_armholestep1#/#sleaveinsleave_bodystichgauge#><br>
Zone_1_height_in = 0><br>
Zone_1_bind_lenght = sqr((#Zone_1_lenght_in#*#Zone_1_lenght_in#))><br>

<cfset Zone_2_lenght_in = sleaveinsleave_step_6_2s/sleaveinsleave_bodystichgauge> <!--- sleaveinsleave_step_6_2s from armhole element --->
<cfset Zone_2_height_in = 4/sleaveinsleave_bodyrowgauge>
<cfset Zone_2_bind_lenght = sqr((Zone_2_lenght_in*Zone_2_lenght_in) + (Zone_2_height_in*Zone_2_height_in))>
 Zone_2_lenght_in = #sleaveinsleave_step_6_2s#/#sleaveinsleave_bodystichgauge#> <!--- sleaveinsleave_step_6_2s from armhole element ---><br>
Zone_2_height_in = 4/#sleaveinsleave_bodyrowgauge#><br>
Zone_2_bind_lenght = sqr((#Zone_2_lenght_in#*#Zone_2_lenght_in#) + (#Zone_2_height_in#*#Zone_2_height_in#))><br>

<cfset Zone_3_lenght_in = sleaveinsleave_armholestep1/sleaveinsleave_bodystichgauge>
<cfset Zone_3_height_in = (sleaveinsleave_armholestep1*2)/sleaveinsleave_bodyrowgauge>
<cfset Zone_3_bind_lenght = sqr((Zone_3_lenght_in*Zone_3_lenght_in) + (Zone_3_height_in*Zone_3_height_in))>
Zone_3_lenght_in = #sleaveinsleave_armholestep1#/#sleaveinsleave_bodystichgauge#><br>
Zone_3_height_in = (#sleaveinsleave_armholestep1#*2)/#sleaveinsleave_bodyrowgauge#><br>
Zone_3_bind_lenght = sqr((#Zone_3_lenght_in#*#Zone_3_lenght_in#) + (#Zone_3_height_in#*#Zone_3_height_in#))><br>


<cfset Zone_4_lenght_in = 0>
Zone_4_height_in = (#sleaveinsleave_shoulderrowstart# - #setinsleeve_armholeshaping_endrow#)/#sleaveinsleave_bodyrowgauge#>
<cfset Zone_4_height_in = (sleaveinsleave_shoulderrowstart - setinsleeve_armholeshaping_endrow)/sleaveinsleave_bodyrowgauge>
<cfset Zone_4_bind_lenght = sqr((Zone_4_height_in*Zone_4_height_in))>
Zone_4_bind_lenght = sqr((#Zone_4_height_in#*#Zone_4_height_in#))>

<cfset parimaterlength = Zone_1_bind_lenght + Zone_2_bind_lenght + Zone_3_bind_lenght + Zone_4_bind_lenght>
parimaterlength = #Zone_1_bind_lenght# + #Zone_2_bind_lenght# + #Zone_3_bind_lenght# + #Zone_4_bind_lenght#><br>
parimaterlength = #parimaterlength#<br>
<!--- end get pararmeter --->
<cfset workingheight_parimater = parimaterlength - sleave_intialbindoff_inches - topslope_slope_inch - Final_bind_Off_inches/2>
 workingheight_parimater  = #workingheight_parimater# = #parimaterlength# - #sleave_intialbindoff_inches# - #topslope_slope_inch# - #Final_bind_Off_inches#/2><br>
<cfset workingheight_inches = sqr((workingheight_parimater*workingheight_parimater) - (workingwitdh_inches*workingwitdh_inches))><br>

look here workingheight_inches = sqr((#workingheight_parimater#*#workingheight_parimater#) - (#workingwitdh_inches#*#workingwitdh_inches#))><br>

<strong>workingheight_inches</strong> = #workingheight_inches#<br>
<Cfset workingheight_rows = int(workingheight_inches * rowgauge)>
workingheight_rows = int(#workingheight_inches# * #rowgauge#)><br>
workingheight_rows = #workingheight_rows#

<cfset point_of_inflection = Zone_1_lenght_in + Zone_2_height_in + Zone_3_height_in>
point_of_inflection #point_of_inflection#<br>
<cfset point_of_inflection_row = point_of_inflection*rowgauge>
point_of_inflection_row =#point_of_inflection_row#<br>
<!--- step2 --->
	<Cfif setinsleeve_Bust_inches lte 30>
			<cfset estimated_cap = 2>
		<Cfelseif setinsleeve_Bust_inches lte 48>
			<cfset estimated_cap = 3>
		<Cfelse>
			<cfset estimated_cap = 4>
	</cfif>

<!--- 
Two options for doing this we chouse the simpler one that gave a larger number
	<Cfset Total_cap_length_inches = sleaveinsleave_armholedepth - (Final_bind_Off_inches/2) - (estimated_cap /2)>
	Total_cap_length_inches = #Total_cap_length_inches#<br>
	Total_cap_length_inches = #sleaveinsleave_armholedepth# - (#Final_bind_Off_inches#/2) - (#estimated_cap# /2)<br>
	or<br> --->
<cfset Total_cap_length_inches = sleaveinsleave_armholedepth - estimated_cap>
Total_cap_length_inches = #Total_cap_length_inches#
<Cfset Total_cap_length_rows = Total_cap_length_inches * rowgauge>
Total_cap_length_rows = #Total_cap_length_rows#<br>
<cfset Cap_workingRows = int((Total_cap_length_inches * rowgauge) - Top_slope_rows - 2)><!--- the 2 is the first two bind rows --->
<cfif BitAnd(Cap_workingRows, 1 )>
		<cfset Cap_workingRows = Cap_workingRows + 1> <!--- make this also odd --->
</cfif>

Cap_workingRows = #Cap_workingRows#<br>
int((#Total_cap_length_inches# * #rowgauge#) - #Top_slope_rows# - 2)<br>
<br>

<!--- start key points for second GREEN TRINGLE--->
<cfset stictchesToRemoveInGreenLine = workingwitdh_stitches*2>
<cfset greenlinestitches = int(stictchesToRemoveInGreenLine/3)>
<Cfif  greenlinestitches * 3 neq Final_bind_off_stitches>
		<cfset Greenline_2_stitches = greenlinestitches + 1>
	<Cfelse>
		<cfset Greenline_2_stitches = greenlinestitches>
</CFIF>

<Cfset greelinerows = int(workingheight_rows/4)>
<Cfif  greelinerows * 4 neq workingheight_rows>
		<cfset Greenline_2_rows = (greelinerows + 1)*2>
	<Cfelse>
		<cfset Greenline_2_rows = greelinerows*2>
</CFIF>


<cfset Greenline_1_stitches = greenlinestitches>
<cfset Greenline_1_rows = greelinerows>

<!--- <cfset Greenline_2_stitches = > DONE ABOVE--->
<!--- <cfset Greenline_2_rows = > Done Above--->

<cfset Greenline_3_stitches = greenlinestitches>
<cfset Greenline_3_rows = greelinerows>

Greenline_1_stitches = #Greenline_1_stitches#<br>
Greenline_1_rows = #Greenline_1_rows#<br>
Greenline_2_stitches = #Greenline_2_stitches#<br>
Greenline_2_rows = #Greenline_2_rows#<br>
Greenline_3_stitches = #Greenline_3_stitches#<br>
Greenline_3_rows = #Greenline_3_rows#<br>



<Cfset "pattern_#actionid#_details.endrow" = rowcount + Total_cap_length_rows>
<!--- step one --->
<Cfset stitchcount = stitchcount - sleaveinsleave_armholestep1>
<cfsavecontent variable="Machine_printedinstructions"> <!--- placing content in staved variable --->
	<tr>
		<td class="rowcounter">RC: #rowcount#</td>
		<td class="knittingdetails">Bind off #sleaveinsleave_armholestep1# Stitches at begining of row.</td>
		<td class="stitch_count">#stitchcount#</td>
	</tr>
</cfsavecontent>	

<cfsavecontent variable="Hand_printedinstructions"> <!--- placing content in staved variable --->
	<tr>
		<td class="rowcounter"></td>
		<td class="knittingdetails">
		Bind off #sleaveinsleave_armholestep1# Stitches at begining of row.
		</td>
		<td class="stitch_count">#stitchcount#</td>
	</tr>
</cfsavecontent>

	<cfset "pattern_#patternid_fk#_knitinfo.rc_#rowcount#.bindoff" = "#sleaveinsleave_armholestep1#">
	<cfset "pattern_#patternid_fk#_knitinfo.rc_#rowcount#.leftremove" = "0">
	<cfset "pattern_#patternid_fk#_knitinfo.rc_#rowcount#.rightremove" = "0">
	<cfset "pattern_#patternid_fk#_knitinfo.rc_#rowcount#.totalremoved" = "0">
	<cfset "pattern_#patternid_fk#_knitinfo.rc_#rowcount#.action" = "1">
	<cfset "pattern_#patternid_fk#_knitinfo.rc_#rowcount#.divider" = "0">
	<cfset "pattern_#patternid_fk#_knitinfo.rc_#rowcount#.stitchcount" = "#stitchcount#">
	<cfset "pattern_#patternid_fk#_knitinfo.rc_#rowcount#.orientation" = " at begining of row">
	<cfset "pattern_#patternid_fk#_knitinfo.rc_#rowcount#.type" = "setinsleeve">
							

<cfset rowcount = rowcount + 1>
<Cfset stitchcount = stitchcount - sleaveinsleave_armholestep1>

<cfsavecontent variable="Machine_printedinstructions"> <!--- placing content in staved variable --->
#Machine_printedinstructions#
	<tr>
		<td class="rowcounter">RC: #rowcount#</td>
		<td class="knittingdetails">
		Bind off #sleaveinsleave_armholestep1# Stitches at begining of row.</td>
		<td class="stitch_count">#stitchcount#</td>
	</tr>
</cfsavecontent>	

<cfsavecontent variable="Hand_printedinstructions"> <!--- placing content in staved variable --->
#Hand_printedinstructions#
	<tr>
		<td class="rowcounter"></td>
		<td class="knittingdetails">Bind off #sleaveinsleave_armholestep1# Stitches at begining of row.</td>
		<td class="stitch_count">#stitchcount#</td>
	</tr>
</cfsavecontent>

	<cfset "pattern_#patternid_fk#_knitinfo.rc_#rowcount#.bindoff" = "#sleaveinsleave_armholestep1#">
	<cfset "pattern_#patternid_fk#_knitinfo.rc_#rowcount#.leftremove" = "0">
	<cfset "pattern_#patternid_fk#_knitinfo.rc_#rowcount#.rightremove" = "0">
	<cfset "pattern_#patternid_fk#_knitinfo.rc_#rowcount#.totalremoved" = "0">
	<cfset "pattern_#patternid_fk#_knitinfo.rc_#rowcount#.action" = "1">
	<cfset "pattern_#patternid_fk#_knitinfo.rc_#rowcount#.divider" = "0">
	<cfset "pattern_#patternid_fk#_knitinfo.rc_#rowcount#.stitchcount" = "#stitchcount#">
	<cfset "pattern_#patternid_fk#_knitinfo.rc_#rowcount#.type" = "setinsleeve">
	<cfset "pattern_#patternid_fk#_knitinfo.rc_#rowcount#.orientation" = " at begining of row">

<cfset rowcount = rowcount + 1>
<!--- finish step 1 --->

<!--- Middle section (Step 2) --->
<Cfloop from="#rowcount#" to="#evaluate("pattern_#actionid#_details.endrow")#" index="pointer">
	<cfset "pattern_#patternid_fk#_knitinfo.rc_#pointer#.bindoff" = "0">
	<cfset "pattern_#patternid_fk#_knitinfo.rc_#pointer#.leftremove" = "0">
	<cfset "pattern_#patternid_fk#_knitinfo.rc_#pointer#.rightremove" = "0">
	<cfset "pattern_#patternid_fk#_knitinfo.rc_#pointer#.totalremoved" = "0">
	<cfset "pattern_#patternid_fk#_knitinfo.rc_#pointer#.action" = "0">
	<cfset "pattern_#patternid_fk#_knitinfo.rc_#pointer#.divider" = "0">
	<cfset "pattern_#patternid_fk#_knitinfo.rc_#pointer#.stitchcount" = stitchcount>
	<cfset "pattern_#patternid_fk#_knitinfo.rc_#pointer#.type" = "setinsleeve">
	<cfset "pattern_#patternid_fk#_knitinfo.rc_#pointer#.orientation" = "">
</CFLOOP>


<!--- Middle section values --->
<!--- <cfset sleavecap_middlesection_stitches = stitchcount - Top_slope_decrease1*2 - Top_slope_decrease2*2 - Top_slope_decrease3*2 - Final_bind_off_stitches>
#stitchcount# - #Top_slope_decrease1#*2 - #Top_slope_decrease2#*2 - #Top_slope_decrease3#*2 - #Final_bind_off_stitches#<br>
sleavecap_middlesection_stitches = #sleavecap_middlesection_stitches#

sleavecap_middlesection_stitches / Cap_workingRows --->


<!--- do the magic formula here --->	

<!--- Greenline shapping - three parts --->
	<!---  part 1 --->
<!--- do the magic formula here --->	
<cfset TaperStitchCount = Greenline_1_stitches>
<cfset removefromboth = 2> 
<cfset RemovePerRow = (Greenline_1_rows/taperstitchcount)*removefromboth> 
<cfset step1_whole = int(RemovePerRow)>
<cfset RemovePerRow_remainder = (Greenline_1_rows mod (TaperStitchCount/removefromboth))>
<cfset MagicStep2 = taperstitchcount/removefromboth - RemovePerRow_remainder> 
<cfset MagicStep3 = step1_whole + 1>

<Cfset tempinches = workingheight_rows/rowgauge> <!--- not right --->
stictice before first decrease = #stitchcount#<br>
<cfsavecontent variable="Machine_printedinstructions"> <!--- placing content in staved variable --->
<cfif form.typeofpattern eq "Machine_printedinstructions">#Machine_printedinstructions#
<Cfelse>
#Hand_printedinstructions#
</cfif>
<cfset chartpointercount = rowcount>
<Cfset tempstitchcount = stitchcount>
<tr>
	<td class="rowcounter"><cfif form.typeofpattern eq "Machine_printedinstructions">RC: #rowcount#</cfif></td>
	<td class="knittingdetails">
	<cfif RemovePerRow_remainder eq 0>		
		Decrease 1 stitch both sides every #step1_whole# rows, #int(MagicStep2)# times<br>
									<!--- Inner detailed chart --->
									
									<span class="innertableinfo">(<cfloop from="1" to="#int(MagicStep2)#" index="pointer">
									<cfset chartpointercount = chartpointercount + step1_whole>
										<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.leftremove" = "1">
										<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.rightremove" = "1">
										<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.totalremoved" = "2">
										<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.action" = "1">
										<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.bindoff" = 0>
										<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.divider" = "0">
										<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.orientation" = "both sides">
										<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.type" = "setinsleeve">
											<cfset tempstitchcount = tempstitchcount - 2> <!--- do one since this is one sides --->
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.stitchcount" = "#tempstitchcount#">
										
												<cfloop from="#chartpointercount#" to="#evaluate("pattern_#actionid#_details.endrow")#" index="innerinfo">
													<cfset "pattern_#patternid_fk#_knitinfo.rc_#innerinfo#.stitchcount" = "#tempstitchcount#">
												</cfloop>
												
									#chartpointercount# <cfif pointer lt int(MagicStep2)>-<cfset chartpointercount = chartpointercount + step1_whole></cfif></cfloop>)</span><br>
									<!---END  Inner detailed chart --->
				<cfelse>
							<cfif step1_whole gt 0>
							Decrease 1 stitch both sides every #step1_whole# rows, #int(MagicStep2)# times<br>
									<!--- Inner detailed chart --->
									<cfset chartpointercount = chartpointercount + step1_whole>
									<span class="innertableinfo">(<cfloop from="1" to="#int(MagicStep2)#" index="pointer">
									
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.leftremove" = "1">
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.rightremove" = "1">
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.totalremoved" = "2">
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.bindoff" = 0>
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.divider" = "0">
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.action" = "1">
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.orientation" = "both sides">
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.type" = "setinsleeve">
											<cfset tempstitchcount = tempstitchcount - 2> <!--- do one since this is one sides --->
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.stitchcount" = "#tempstitchcount#">
										
												<cfloop from="#chartpointercount#" to="#evaluate("pattern_#actionid#_details.endrow")#" index="innerinfo">
													<cfset "pattern_#patternid_fk#_knitinfo.rc_#innerinfo#.stitchcount" = "#tempstitchcount#">
												</cfloop>
									
									#chartpointercount# <cfif pointer lt int(MagicStep2)>-<cfset chartpointercount = chartpointercount + step1_whole></cfif></cfloop>)</span><br>
							</cfif>		
									<!---END  Inner detailed chart --->
									<cfset chartpointercount = chartpointercount + MagicStep3>
									Decrease 1 stitch both sides every #MagicStep3# rows, #int(RemovePerRow_remainder)# times<br>
									<!--- Inner detailed chart --->
									<span class="innertableinfo">(<cfloop from="1" to="#int(RemovePerRow_remainder)#" index="pointer">
									
										<cfset "pattern_#actionid#_details.RC_#chartpointercount#.leftremove" = "1">
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.rightremove" = "1">
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.totalremoved" = "2">
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.bindoff" = 0>
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.divider" = "0">
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.action" = "1">
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.orientation" = "both sides">
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.type" = "setinsleeve">
											
											<cfset tempstitchcount = tempstitchcount - 2> <!--- do one since this is one sides --->
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.stitchcount" = "#tempstitchcount#">
										
												<cfloop from="#chartpointercount#" to="#evaluate("pattern_#actionid#_details.endrow")#" index="innerinfo">
													<cfset "pattern_#patternid_fk#_knitinfo.rc_#innerinfo#.stitchcount" = "#tempstitchcount#">
												</cfloop>
									
									#chartpointercount# <cfif pointer lt int(RemovePerRow_remainder)>-<cfset chartpointercount = chartpointercount + MagicStep3></cfif></cfloop>)</span><br>
									<!---END  Inner detailed chart --->
				</cfif>
			</td>
			<td class="stitch_count_bottom" valign="bottom">#evaluate("pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.stitchcount")#</td>
	</tr>
<cfset rowcount = chartpointercount + 1>
<Cfset stitchcount = evaluate("pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.stitchcount")>
<!--- set the reset of the sticks to the last count --->
<!--- <Cfloop from="#rowcount#" to="#evaluate("pattern_#actionid#_details.endrow")#" index="pointer">
	<cfset "pattern_#patternid_fk#_knitinfo.rc_#pointer#.stitchcount" = stitchcount>
</CFLOOP> --->
<!--- end part 1 --->

<!---  part 2 --->
<!--- do the magic formula here --->	
<cfset TaperStitchCount = Greenline_2_stitches>
<cfset RemovePerRow = (Greenline_2_rows/taperstitchcount)*removefromboth> 
<cfset step1_whole = int(RemovePerRow)>
<cfset RemovePerRow_remainder = (Greenline_2_rows mod (TaperStitchCount/removefromboth))>
<cfset MagicStep2 = taperstitchcount/removefromboth - RemovePerRow_remainder> 
<cfset MagicStep3 = step1_whole + 1>
	<Cfset tempinches = workingheight_rows/rowgauge> <!--- not right --->
	
	<cfset innerchartcount = rowcount>
	<cfset tempstitchcount = stitchcount>
	
<tr>
	<td class="rowcounter"><cfif form.typeofpattern eq "Machine_printedinstructions">RC: #rowcount#</cfif></td>
	<td class="knittingdetails">
	<cfif RemovePerRow_remainder eq 0>		
			Decrease 1 stitch both sides every #step1_whole# rows, #int(MagicStep2)# times<br>
									<!--- Inner detailed chart --->
									<cfset chartpointercount = innerchartcount>
									<cfset chartpointercount = chartpointercount + step1_whole>
									<span class="innertableinfo">(<cfloop from="1" to="#int(MagicStep2)#" index="pointer">
									
										<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.leftremove" = "1">
										<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.rightremove" = "1">
										<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.totalremoved" = "2">
										<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.action" = "1">
										<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.bindoff" = 0>
										<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.divider" = "0">
										<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.orientation" = "both sides">
										<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.type" = "setinsleeve">
										
											<cfset tempstitchcount = tempstitchcount - 2> <!--- do one since this is one sides --->
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.stitchcount" = "#tempstitchcount#">
										
												<cfloop from="#chartpointercount#" to="#evaluate("pattern_#actionid#_details.endrow")#" index="innerinfo">
													<cfset "pattern_#patternid_fk#_knitinfo.rc_#innerinfo#.stitchcount" = "#tempstitchcount#">
												</cfloop>
												
									#chartpointercount# <cfif pointer lt int(MagicStep2)>-<cfset chartpointercount = chartpointercount + step1_whole></cfif></cfloop>)</span><br>
									<!---END  Inner detailed chart --->
				<cfelse>
				Decrease 1 stitch both sides every #step1_whole# rows, #int(MagicStep2)# times<br>
									<!--- Inner detailed chart --->
									<cfset chartpointercount = innerchartcount>
									<cfset chartpointercount = chartpointercount + step1_whole>
									<span class="innertableinfo">(<cfloop from="1" to="#int(MagicStep2)#" index="pointer">
									
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.leftremove" = "1">
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.rightremove" = "1">
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.totalremoved" = "2">
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.bindoff" = 0>
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.divider" = "0">
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.action" = "1">
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.orientation" = "both sides">
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.type" = "setinsleeve">
											
											<cfset tempstitchcount = tempstitchcount - 2> <!--- do one since this is one sides --->
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.stitchcount" = "#tempstitchcount#">
										
												<cfloop from="#chartpointercount#" to="#evaluate("pattern_#actionid#_details.endrow")#" index="innerinfo">
													<cfset "pattern_#patternid_fk#_knitinfo.rc_#innerinfo#.stitchcount" = "#tempstitchcount#">
												</cfloop>
									
									#chartpointercount# <cfif pointer lt int(MagicStep2)>-<cfset chartpointercount = chartpointercount + step1_whole></cfif></cfloop>)</span><br>
									<!---END  Inner detailed chart --->
									<cfset chartpointercount = chartpointercount + MagicStep3>
									Decrease 1 stitch both sides every #MagicStep3# rows, #int(RemovePerRow_remainder)# times<br>
									<!--- Inner detailed chart --->
									<span class="innertableinfo">(<cfloop from="1" to="#int(RemovePerRow_remainder)#" index="pointer">
									
											<cfset "pattern_#actionid#_details.RC_#chartpointercount#.leftremove" = "1">
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.rightremove" = "1">
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.totalremoved" = "2">
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.bindoff" = 0>
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.divider" = "0">
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.action" = "1">
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.orientation" = "both sides">
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.type" = "setinsleeve">
											<cfset tempstitchcount = tempstitchcount - 2> <!--- do one since this is one sides --->
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.stitchcount" = "#tempstitchcount#">
										
												<cfloop from="#chartpointercount#" to="#evaluate("pattern_#actionid#_details.endrow")#" index="innerinfo">
													<cfset "pattern_#patternid_fk#_knitinfo.rc_#innerinfo#.stitchcount" = "#tempstitchcount#">
												</cfloop>
									
									#chartpointercount# <cfif pointer lt int(RemovePerRow_remainder)>-<cfset chartpointercount = chartpointercount + MagicStep3></cfif></cfloop>)</span><br>
									<!---END  Inner detailed chart --->
				</cfif>
			</td>
			<td class="stitch_count_bottom" valign="bottom">#evaluate("pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.stitchcount")#</td>
	</tr>
<cfset rowcount = chartpointercount + 1>
<cfset stitchcount = evaluate("pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.stitchcount")>
<!--- end part 2 --->


<!---  part 3 --->
<!--- do the magic formula here --->	
	<!--- do the magic formula here --->	
<cfset TaperStitchCount = Greenline_3_stitches>
<cfset RemovePerRow = (Greenline_3_rows/taperstitchcount)*removefromboth> 
<cfset step1_whole = int(RemovePerRow)>
<cfset RemovePerRow_remainder = (Greenline_3_rows mod (TaperStitchCount/removefromboth))>
<cfset MagicStep2 = taperstitchcount/removefromboth - RemovePerRow_remainder> 
<cfset MagicStep3 = step1_whole + 1>
	<Cfset tempinches = workingheight_rows/rowgauge> <!--- not right --->
	
	<cfset innerchartcount = rowcount>
	<cfset tempstitchcount = stitchcount>
	
<tr>
	<td class="rowcounter"><cfif form.typeofpattern eq "Machine_printedinstructions">RC: #rowcount#</cfif></td>
	<td class="knittingdetails">
	<cfif RemovePerRow_remainder eq 0>		
			Decrease 1 stitch both sides every #step1_whole# rows, #int(MagicStep2)# times<br>
									<!--- Inner detailed chart --->
									<cfset chartpointercount = innerchartcount>
									<cfset chartpointercount = chartpointercount + step1_whole>
									<span class="innertableinfo">(<cfloop from="1" to="#int(MagicStep2)#" index="pointer">
									
										<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.leftremove" = "1">
										<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.rightremove" = "1">
										<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.totalremoved" = "2">
										<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.action" = "1">
										<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.bindoff" = 0>
										<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.divider" = "0">
										<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.orientation" = "both sides">
										<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.type" = "setinsleeve">
											<cfset tempstitchcount = tempstitchcount - 2> <!--- do one since this is one sides --->
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.stitchcount" = "#tempstitchcount#">
										
												<cfloop from="#chartpointercount#" to="#evaluate("pattern_#actionid#_details.endrow")#" index="innerinfo">
													<cfset "pattern_#patternid_fk#_knitinfo.rc_#innerinfo#.stitchcount" = "#tempstitchcount#">
												</cfloop>
												
									#chartpointercount# <cfif pointer lt int(MagicStep2)>-<cfset chartpointercount = chartpointercount + step1_whole></cfif></cfloop>)</span><br>
									<!---END  Inner detailed chart --->
				<cfelse>
							Decrease 1 stitch both sides every #step1_whole# rows, #int(MagicStep2)# times<br>
									<!--- Inner detailed chart --->
									<cfset chartpointercount = innerchartcount>
									<cfset chartpointercount = chartpointercount + step1_whole>
									<span class="innertableinfo">(<cfloop from="1" to="#int(MagicStep2)#" index="pointer">
									
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.leftremove" = "1">
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.rightremove" = "1">
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.totalremoved" = "2">
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.bindoff" = 0>
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.divider" = "0">
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.action" = "1">
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.orientation" = "both sides">
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.type" = "setinsleeve">
											<cfset tempstitchcount = tempstitchcount - 2> <!--- do one since this is one sides --->
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.stitchcount" = "#tempstitchcount#">
										
												<cfloop from="#chartpointercount#" to="#evaluate("pattern_#actionid#_details.endrow")#" index="innerinfo">
													<cfset "pattern_#patternid_fk#_knitinfo.rc_#innerinfo#.stitchcount" = "#tempstitchcount#">
												</cfloop>
									
									#chartpointercount# <cfif pointer lt int(MagicStep2)>-<cfset chartpointercount = chartpointercount + step1_whole></cfif></cfloop>)</span><br>
									<!---END  Inner detailed chart --->
									<cfset chartpointercount = chartpointercount + MagicStep3>
									Decrease 1 stitch both sides every #MagicStep3# rows, #int(RemovePerRow_remainder)# times<br>
									<!--- Inner detailed chart --->
									<span class="innertableinfo">(<cfloop from="1" to="#int(RemovePerRow_remainder)#" index="pointer">
									
											<cfset "pattern_#actionid#_details.RC_#chartpointercount#.leftremove" = "1">
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.rightremove" = "1">
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.totalremoved" = "2">
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.bindoff" = 0>
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.divider" = "0">
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.action" = "1">
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.orientation" = "both sides">
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.type" = "setinsleeve">
											<cfset tempstitchcount = tempstitchcount - 2> <!--- do one since this is one sides --->
											<cfset "pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.stitchcount" = "#tempstitchcount#">
										
												<cfloop from="#chartpointercount#" to="#evaluate("pattern_#actionid#_details.endrow")#" index="innerinfo">
													<cfset "pattern_#patternid_fk#_knitinfo.rc_#innerinfo#.stitchcount" = "#tempstitchcount#">
												</cfloop>
									
									#chartpointercount# <cfif pointer lt int(RemovePerRow_remainder)>-<cfset chartpointercount = chartpointercount + MagicStep3></cfif></cfloop>)</span><br>
									<!---END  Inner detailed chart --->
				</cfif>
			</td>
			<td class="stitch_count_bottom" valign="bottom">#evaluate("pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.stitchcount")#</td>
	</tr>
</cfsavecontent>
<cfset rowcount = chartpointercount>  <!--- do not add on here --->
<cfset stitchcount = evaluate("pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.stitchcount")>


<!--- end part 3 --->
<!--- Greenline shapping - end parts --->



<!--- End Magic forumlas --->
<Cfset stitchcount = evaluate("pattern_#patternid_fk#_knitinfo.rc_#chartpointercount#.stitchcount")>

<!--- up two rows --->
<cfset rowcount = rowcount + 1>
<cfloop from="#rowcount#" to="#evaluate(rowcount+ 1)#" index="pointer">
	<cfset "pattern_#patternid_fk#_knitinfo.rc_#pointer#.action" = "0">
	<cfset "pattern_#patternid_fk#_knitinfo.rc_#pointer#.divider" = "0">
	<cfset "pattern_#patternid_fk#_knitinfo.rc_#pointer#.type" = "setinsleeve">
	<cfset "pattern_#patternid_fk#_knitinfo.rc_#pointer#.stitchcount" = "#stitchcount#">	
</cfloop>
<cfset rowcount = rowcount + 1>


<!--- Top Slope Part do smallest to largest--->
<cfloop list="#topsloperowlist#" index="pointer">
<Cfif pointer gt 0>
	<Cfset stitchcount = stitchcount - pointer*2>
	<cfsavecontent variable="Machine_printedinstructions"> <!--- placing content in staved variable --->
	#Machine_printedinstructions#
		<tr>
			<td class="rowcounter"><cfif form.typeofpattern eq "Machine_printedinstructions">RC: #rowcount#</cfif></td>
			<td class="knittingdetails">
			Decrease #pointer# Stitches on each side.</td>
			<td class="stitch_count">#stitchcount#</td>
		</tr>
	</cfsavecontent>	
	
	<cfsavecontent variable="Hand_printedinstructions"> <!--- placing content in staved variable --->
	#Hand_printedinstructions#
		<tr>
			<td class="rowcounter"></td>
			<td class="knittingdetails">Decrease #pointer# Stitches on each side.</td>
			<td class="stitch_count">#stitchcount#</td>
		</tr>
	</cfsavecontent>
			
			<cfset "pattern_#patternid_fk#_knitinfo.rc_#rowcount#.leftremove" = "#pointer#">
			<cfset "pattern_#patternid_fk#_knitinfo.rc_#rowcount#.rightremove" = "#pointer#">
			<cfset "pattern_#patternid_fk#_knitinfo.rc_#rowcount#.totalremoved" = "#evaluate(pointer*2)#">
			<cfset "pattern_#patternid_fk#_knitinfo.rc_#rowcount#.action" = "1">
			<cfset "pattern_#patternid_fk#_knitinfo.rc_#rowcount#.bindoff" = 0>
			<cfset "pattern_#patternid_fk#_knitinfo.rc_#rowcount#.divider" = "0">
			<cfset "pattern_#patternid_fk#_knitinfo.rc_#rowcount#.endsleavecap" = "#pointer#">
			<cfset "pattern_#patternid_fk#_knitinfo.rc_#rowcount#.orientation" = "both sides">
			<cfset "pattern_#patternid_fk#_knitinfo.rc_#rowcount#.type" = "setinsleeve">
			<cfset "pattern_#patternid_fk#_knitinfo.rc_#rowcount#.stitchcount" = "#stitchcount#">	
	
	<cfloop from="#rowcount#" to="#evaluate("pattern_#actionid#_details.endrow")#" index="innerinfo">
			<cfset "pattern_#patternid_fk#_knitinfo.rc_#innerinfo#.stitchcount" = "#stitchcount#">
	</cfloop>
	
	<cfset rowcount = rowcount + 1>
	
	<cfsavecontent variable="Machine_printedinstructions"> <!--- placing content in staved variable --->
		#Machine_printedinstructions#
			<tr>
				<td class="rowcounter"><cfif form.typeofpattern eq "Machine_printedinstructions">RC: #rowcount#</cfif></td>
				<td class="knittingdetails">
				Knit 1 Row.</td>
				<td class="stitch_count">#stitchcount#</td>
			</tr>
		</cfsavecontent>	

<cfsavecontent variable="Hand_printedinstructions"> <!--- placing content in staved variable --->
#Hand_printedinstructions#
	<tr>
		<td class="rowcounter"></td>
		<td class="knittingdetails">Knit 1 Row.</td>
		<td class="stitch_count">#stitchcount#</td>
	</tr>
</cfsavecontent>
	
	<cfset "pattern_#patternid_fk#_knitinfo.rc_#rowcount#.leftremove" = "0">
	<cfset "pattern_#patternid_fk#_knitinfo.rc_#rowcount#.rightremove" = "0">
	<cfset "pattern_#patternid_fk#_knitinfo.rc_#rowcount#.totalremoved" = "0">
	<cfset "pattern_#patternid_fk#_knitinfo.rc_#rowcount#.action" = "1">
	<cfset "pattern_#patternid_fk#_knitinfo.rc_#rowcount#.bindoff" = 0>
	<cfset "pattern_#patternid_fk#_knitinfo.rc_#rowcount#.divider" = "0">
	<cfset "pattern_#patternid_fk#_knitinfo.rc_#rowcount#.orientation" = "both sides">
	<cfset "pattern_#patternid_fk#_knitinfo.rc_#rowcount#.type" = "KnitoneRow">		
	<cfset "pattern_#patternid_fk#_knitinfo.rc_#rowcount#.stitchcount" = "#stitchcount#">		
	<cfset rowcount = rowcount + 1>
</cfif>
</cfloop>	


<!--- end intial fist decrease --->




	<!--- using machine instructions for hand --->
	<cfsavecontent variable="Machine_printedinstructions"> <!--- placing content in staved variable --->
		#Machine_printedinstructions#
			<tr>
				<td class="rowcounter"><cfif form.typeofpattern eq "Machine_printedinstructions">RC: #rowcount#</cfif></td>
				<td class="knittingdetails">
				Bind off remaining stitches.</td>
				<td class="stitch_count">#stitchcount#</td>
			</tr>
		</cfsavecontent>	


endrow = #rowcount#
	<cfset "pattern_#patternid_fk#_knitinfo.rc_#rowcount#.type" = "bindoff">
	<cfset "pattern_#patternid_fk#_knitinfo.rc_#rowcount#.stitchcount" = "#stitchcount#">
	<cfset "pattern_#patternid_fk#_knitinfo.rc_#rowcount#.action" = "1">
	<cfset "pattern_#patternid_fk#_knitinfo.rc_#rowcount#.divider" = "0">
	
<Cfset "pattern_#actionid#_details.endrow" = rowcount> <!--- set this to the last row we are at --->

<cfset "pattern_#actionid#_details.Machine_printedinstructions" = Machine_printedinstructions>
<cfset "pattern_#actionid#_details.Hand_printedinstructions" = Machine_printedinstructions> <!--- use the Machine_printedinstructions info since we do the same for both sides --->

<cfif details.uselable>
	<cfif len(details.lable) gt 0>
			<cfset "pattern_#patternid_fk#.paternitem_#Actionid#.stitchtype" = "Sleeve Cap Height">
			<cfset "pattern_#patternid_fk#.paternitem_#Actionid#.lable" = "#details.lable#">
			<cfset "pattern_#patternid_fk#.paternitem_#Actionid#.stiches" = "#stitchcount#">
			<cfset "pattern_#patternid_fk#.paternitem_#Actionid#.inches" = "#numberformat(step13c,"999.99")#">
			<cfset "pattern_#patternid_fk#.paternitem_#Actionid#.rows" = "">
			<cfset "pattern_#patternid_fk#.patternorder" = listappend(evaluate("pattern_#patternid_fk#.patternorder"),Actionid)>
	</cfif>

	<cfif  len(details.lable2) gt 0>
		<cfset "pattern_#patternid_fk#.paternitem_#Actionid#_2.stitchtype" = "Sleeve Cap Top">
		<cfset "pattern_#patternid_fk#.paternitem_#Actionid#_2.lable" = "#details.lable2#">
		<cfset "pattern_#patternid_fk#.paternitem_#Actionid#_2.stiches" = "#stitchcount#"> <!--- set to the remiander of stitches on the needle --->
		<cfset "pattern_#patternid_fk#.paternitem_#Actionid#_2.inches" = "">
		<cfset "pattern_#patternid_fk#.paternitem_#Actionid#_2.rows" = "">
		<cfset "pattern_#patternid_fk#.patternorder" = listappend(evaluate("pattern_#patternid_fk#.patternorder"),"#Actionid#_2")>
	</cfif> 
</cfif>

</cfoutput>

