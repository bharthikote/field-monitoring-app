-- Removes a stray "Potash 0%" component that ended up attached to the DAP
-- nutrient configuration during earlier manual testing of the Nutrient
-- Configurations admin page. DAP is only Nitrogen 18% + Phosphorus 46% -
-- the zero-percent Potash row isn't part of the product's real composition
-- and was showing up in the item preview's composition breakdown.
delete from nutrient_configuration_components
where configuration_id = (select id from nutrient_configurations where name = 'DAP')
  and nutrient_id = (select id from nutrients where name = 'Potash')
  and percentage = 0;
