select setval('tmm.ccsb_buildout_buildout_id_seq', (select MAX(buildout_id) from tmm.ccsb_buildout));
select setval('tmm.ccsb_dock_shop_map_dock_shop_id_seq', (select MAX(dock_shop_id) from tmm.ccsb_dock_shop_map));
select setval('tmm.ccsb_galc_shop_galc_shop_id_seq', (select MAX(galc_shop_id) from tmm.ccsb_galc_shop));
select setval('tmm.ccsb_global_safety_repository_global_safety_repo_id_seq', (select MAX(global_safety_repo_id) from tmm.ccsb_global_safety_repository));
select setval('tmm.ccsb_gsnp_job_suspend_status_suspend_galc_snapshot_id_seq', (select MAX(suspend_galc_snapshot_id) from tmm.ccsb_gsnp_job_suspend_status));
select setval('tmm.ccsb_inventory_groups_inventory_group_id_seq', (select MAX(inventory_group_id) from tmm.ccsb_inventory_groups));
select setval('tmm.ccsb_job_details_job_detail_id_seq', (select MAX(job_detail_id) from tmm.ccsb_job_details ));
select setval('tmm.ccsb_monitoring_monitoring_id_seq', (select MAX(monitoring_id) from tmm.ccsb_monitoring ));
select setval('tmm.ccsb_obsolescence_obso_part_id_seq', (select MAX(obso_part_id) from tmm.ccsb_obsolescence));
select setval('tmm.ccsb_service_parts_requirement_requirement_id_seq', (select MAX(requirement_id) from tmm.ccsb_service_parts_requirement ));
select setval('tmm.ccsb_supplier_contacts_supplier_contact_id_seq', (select MAX(supplier_contact_id) from tmm.ccsb_supplier_contacts));
select setval('tmm.ccsb_inventory_inventory_id_seq', (select MAX(inventory_id) from tmm.ccsb_inventory));
select setval('tmm.ccsb_common_attachments_common_attachments_id_seq', (select MAX(common_attachments_id) from tmm.ccsb_common_attachments));
select setval('tmm.ccsb_common_attachments_db2_generated_rowid_for_lobs_seq', (select MAX(db2_generated_rowid_for_lobs) from tmm.ccsb_common_attachments));
select setval('tmm.ccsb_countdown_calc_inventory_tag_batch_id_seq', (select MAX(inventory_tag_batch_id) from tmm.ccsb_countdown_calc));
select setval('tmm.ccsb_countdown_data_archive_id_seq', (select MAX(archive_id) from tmm.ccsb_countdown_data));
select setval('tmm.ccsb_countdown_status_status_id_seq', (select MAX(status_id) from tmm.ccsb_countdown_status));
select setval('tmm.ccsb_email_messages_supplier_email_messages_id_seq', (select MAX(supplier_email_messages_id) from tmm.ccsb_email_messages));
select setval('tmm.ccsb_supplier_attachments_db2_generated_rowid_for_lobs_seq', (select MAX(db2_generated_rowid_for_lobs) from tmm.ccsb_supplier_attachments));
select setval('tmm.ccsb_errors_error_id_seq', (select MAX(error_id) from tmm.ccsb_errors));
select setval('tmm.ccsb_inventory_counts_input_inventory_count_input_id_seq', (select MAX(inventory_count_input_id) from tmm.ccsb_inventory_counts_input));
select setval('tmm.ccsb_inventory_parts_part_selection_id_seq', (select MAX(part_selection_id) from tmm.ccsb_inventory_parts));
select setval('tmm.ccsb_na_routes_in_transit_routes_id_seq', (select MAX(in_transit_routes_id) from tmm.ccsb_na_routes));
select setval('tmm.ccsb_overseas_dock_osc_dock_id_seq', (select MAX(osc_dock_id) from tmm.ccsb_overseas_dock));
select setval('tmm.ccsb_overseas_intransit_in_transit_ospipeline_id_seq', (select MAX(in_transit_ospipeline_id) from tmm.ccsb_overseas_intransit));
select setval('tmm.ccsb_overseas_inventory_osc_inventory_id_seq', (select MAX(osc_inventory_id) from tmm.ccsb_overseas_inventory));
select setval('tmm.ccsb_parts_criteria_part_criteria_id_seq', (select MAX(part_criteria_id) from tmm.ccsb_parts_criteria));
select setval('tmm.ccsb_unit_gentani_id_unit_gentani_id_seq', (select MAX(unit_gentani_id) from tmm.ccsb_unit_gentani_id));
select setval('tmm.ccsb_unit_line_inventory_unit_line_inventory_id_seq', (select MAX(unit_line_inventory_id) from tmm.ccsb_unit_line_inventory));
select setval('tmm.ccsb_units_remaining_units_remaining_id_seq', (select MAX(units_remaining_id) from tmm.ccsb_units_remaining));
select setval('tmm.ccsb_warnings_warning_message_id_seq', (select MAX(warning_message_id) from tmm.ccsb_warnings));
select setval('tmm.ccsb_warnings_db2_generated_rowid_for_lobs_seq', (select MAX(db2_generated_rowid_for_lobs) from tmm.ccsb_warnings));
select setval('tmm.ccsb_partial_piece_count_criteria_definition_id_seq',(select MAX(criteria_definition_id) from tmm.ccsb_partial_piece_count));
select setval('tmm.ccsb_batch_file_field_column_map_map_id_seq',(select MAX(map_id) from tmm.ccsb_batch_file_field_column_map));
select setval('tmm.ccsb_piece_count_piece_count_id_seq',(select MAX(piece_count_id) from tmm.ccsb_piece_count));
select setval('tmm.ccsr_counter_info_setup_counterinfo_id_seq', (select MAX(counterinfo_id) from tmm.ccsr_counter_info_setup));

