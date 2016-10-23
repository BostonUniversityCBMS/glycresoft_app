import os
from click import Abort

from glycresoft_app.utils import json_serializer
from .task_process import Task, Message

from glycan_profiling.cli.validators import (
    validate_averagine, validate_sample_run_name)

import ms_deisotope
import ms_peak_picker

from ms_deisotope.processor import MzMLLoader
from glycan_profiling.profiler import SampleConsumer
from glycan_profiling.serialize import DatabaseBoundOperation


def preprocess(mzml_file, database_connection, averagine=None, start_time=None, end_time=None, maximum_charge=None,
               name=None, msn_averagine=None, score_threshold=15., msn_score_threshold=2., missed_peaks=1,
               channel=None):
    minimum_charge = 1 if maximum_charge > 0 else -1
    charge_range = (minimum_charge, maximum_charge)

    loader = MzMLLoader(mzml_file)

    start_scan_id = loader._locate_ms1_scan(
        loader.get_scan_by_time(start_time)).id
    end_scan_id = loader._locate_ms1_scan(
        loader.get_scan_by_time(end_time)).id

    if name is None:
        name = os.path.splitext(os.path.basename(mzml_file))[0]

    name = validate_sample_run_name(None, database_connection, name)

    try:
        averagine = validate_averagine(averagine)
    except Abort:
        channel.send(Message("Could not validate MS1 Averagine %s" % averagine, 'error'))
        return

    try:
        msn_averagine = validate_averagine(msn_averagine)
    except Abort:
        channel.send(Message("Could not validate MSn Averagine %s" % msn_averagine, 'error'))
        return

    ms1_peak_picking_args = {
        "transforms": [
            ms_peak_picker.scan_filter.FTICRBaselineRemoval(scale=2.),
            ms_peak_picker.scan_filter.SavitskyGolayFilter()
        ]
    }

    ms1_deconvolution_args = {
        "scorer": ms_deisotope.scoring.PenalizedMSDeconVFitter(score_threshold),
        "max_missed_peaks": missed_peaks,
        "averagine": averagine
    }

    msn_deconvolution_args = {
        "scorer": ms_deisotope.scoring.MSDeconVFitter(msn_score_threshold),
        "averagine": msn_averagine,
        "max_missed_peaks": missed_peaks,
    }

    consumer = SampleConsumer(
        mzml_file, averagine=averagine, charge_range=charge_range,
        ms1_peak_picking_args=ms1_peak_picking_args,
        ms1_deconvolution_args=ms1_deconvolution_args,
        msn_peak_picking_args=None,
        msn_deconvolution_args=msn_deconvolution_args,
        storage_path=database_connection, sample_name=name,
        start_scan_id=start_scan_id,
        end_scan_id=end_scan_id)

    try:
        handle = DatabaseBoundOperation(database_connection)
        consumer.start()
        sample_run = consumer.sample_run
        handle.session.add(sample_run)
        channel.send(Message(json_serializer.handle_sample_run(sample_run), "new-sample-run"))
        handle.session.close()
    except:
        channel.send(Message.traceback())


class PreprocessMSTask(Task):
    def __init__(self, mzml_file, database_connection, averagine, start_time, end_time, maximum_charge,
                 name, msn_averagine, score_threshold, msn_score_threshold, missed_peaks, callback,
                 **kwargs):
        args = (mzml_file, database_connection, averagine, start_time, end_time, maximum_charge,
                name, msn_averagine, score_threshold, msn_score_threshold, missed_peaks)
        job_name = "Preprocess MS %s" % (name,)
        kwargs.setdefault('name', job_name)
        Task.__init__(self, preprocess, args, callback, **kwargs)