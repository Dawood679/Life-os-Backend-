const JobApplication = require('../models/JobApplication');
const lifeScoreService = require('../services/lifeScoreService');

/**
 * 1. Get All Job Applications with Filtering, Search & Sorting
 */
const getJobApplications = async (req, res) => {
  try {
    const { status, priority, location, search, sortBy = 'appliedDate', sortOrder = 'desc' } = req.query;

    const query = { user: req.user._id };

    if (status && status !== 'all') {
      query.status = status;
    }

    if (priority && priority !== 'all') {
      query.priority = priority;
    }

    if (location && location !== 'all') {
      query.location = location;
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { company: regex },
        { roleTitle: regex },
        { locationDetail: regex },
        { 'networking.personName': regex },
        { notes: regex }
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const applications = await JobApplication.find(query).sort(sortOptions);

    res.status(200).json({
      success: true,
      count: applications.length,
      applications
    });
  } catch (error) {
    console.error('Error in getJobApplications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch job applications.'
    });
  }
};

/**
 * 2. Create Single Job Application
 */
const createJobApplication = async (req, res) => {
  try {
    const {
      company,
      roleTitle,
      appliedDate,
      followUpDate,
      priority = 'medium',
      jobType = 'full_time',
      source = 'linkedin',
      jobUrl = '',
      status = 'applied',
      interviewDate,
      notificationPref = 'in_app',
      salaryRange = '',
      location = 'remote',
      locationDetail = '',
      contactEmail = '',
      networking = {},
      rejectionReason = {},
      jobDescription = '',
      notes = ''
    } = req.body;

    if (!company || !company.trim() || !roleTitle || !roleTitle.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Company name and job title/role are required.'
      });
    }

    const appDate = appliedDate ? new Date(appliedDate) : new Date();
    const calculatedFollowUp = followUpDate
      ? new Date(followUpDate)
      : new Date(appDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    const newApplication = new JobApplication({
      user: req.user._id,
      company: company.trim(),
      roleTitle: roleTitle.trim(),
      appliedDate: appDate,
      followUpDate: calculatedFollowUp,
      priority,
      jobType,
      source,
      jobUrl: (jobUrl || '').trim(),
      status,
      interviewDate: interviewDate ? new Date(interviewDate) : undefined,
      notificationPref,
      salaryRange: (salaryRange || '').trim(),
      location,
      locationDetail: (locationDetail || '').trim(),
      contactEmail: (contactEmail || '').trim().toLowerCase(),
      networking: {
        personName: (networking?.personName || '').trim(),
        profileUrl: (networking?.profileUrl || '').trim(),
        notes: (networking?.notes || '').trim()
      },
      rejectionReason: {
        category: rejectionReason?.category || 'none',
        details: (rejectionReason?.details || '').trim()
      },
      jobDescription: (jobDescription || '').trim(),
      notes: (notes || '').trim(),
      stageHistory: [
        {
          fromStatus: 'created',
          toStatus: status,
          changedAt: new Date()
        }
      ]
    });

    await newApplication.save();

    // Trigger background Life Score recalculation (Career velocity boost)
    lifeScoreService.calculateDailyScore(req.user._id).catch(() => {});

    res.status(201).json({
      success: true,
      message: 'Job application tracked successfully.',
      application: newApplication
    });
  } catch (error) {
    console.error('Error in createJobApplication:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create job application.'
    });
  }
};

/**
 * 3. Update Existing Job Application
 */
const updateJobApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await JobApplication.findOne({ _id: id, user: req.user._id });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Job application not found.'
      });
    }

    const {
      company,
      roleTitle,
      appliedDate,
      followUpDate,
      priority,
      jobType,
      source,
      jobUrl,
      status,
      interviewDate,
      notificationPref,
      salaryRange,
      location,
      locationDetail,
      contactEmail,
      networking,
      rejectionReason,
      jobDescription,
      notes,
      orderIndex
    } = req.body;

    if (company) existing.company = company.trim();
    if (roleTitle) existing.roleTitle = roleTitle.trim();
    if (appliedDate) existing.appliedDate = new Date(appliedDate);
    if (followUpDate) existing.followUpDate = new Date(followUpDate);
    if (priority) existing.priority = priority;
    if (jobType) existing.jobType = jobType;
    if (source) existing.source = source;
    if (jobUrl !== undefined) existing.jobUrl = (jobUrl || '').trim();
    if (salaryRange !== undefined) existing.salaryRange = (salaryRange || '').trim();
    if (location) existing.location = location;
    if (locationDetail !== undefined) existing.locationDetail = (locationDetail || '').trim();
    if (contactEmail !== undefined) existing.contactEmail = (contactEmail || '').trim().toLowerCase();
    if (jobDescription !== undefined) existing.jobDescription = (jobDescription || '').trim();
    if (notes !== undefined) existing.notes = (notes || '').trim();
    if (notificationPref) existing.notificationPref = notificationPref;
    if (orderIndex !== undefined) existing.orderIndex = orderIndex;

    if (interviewDate !== undefined) {
      existing.interviewDate = interviewDate ? new Date(interviewDate) : undefined;
    }

    if (networking) {
      existing.networking = {
        personName: (networking.personName !== undefined ? networking.personName : existing.networking?.personName || '').trim(),
        profileUrl: (networking.profileUrl !== undefined ? networking.profileUrl : existing.networking?.profileUrl || '').trim(),
        notes: (networking.notes !== undefined ? networking.notes : existing.networking?.notes || '').trim()
      };
    }

    if (rejectionReason) {
      existing.rejectionReason = {
        category: rejectionReason.category || existing.rejectionReason?.category || 'none',
        details: (rejectionReason.details !== undefined ? rejectionReason.details : existing.rejectionReason?.details || '').trim()
      };
    }

    // If status changed, record stage history
    if (status && status !== existing.status) {
      existing.stageHistory.push({
        fromStatus: existing.status,
        toStatus: status,
        changedAt: new Date()
      });
      existing.status = status;
    }

    await existing.save();

    lifeScoreService.calculateDailyScore(req.user._id).catch(() => {});

    res.status(200).json({
      success: true,
      message: 'Job application updated successfully.',
      application: existing
    });
  } catch (error) {
    console.error('Error in updateJobApplication:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update job application.'
    });
  }
};

/**
 * 4. Lightweight Status Drag/Drop Switcher
 */
const updateApplicationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionCategory, rejectionDetails } = req.body;

    const validStatuses = ['wishlist', 'applied', 'interviewing', 'offer', 'rejected', 'archived'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const application = await JobApplication.findOne({ _id: id, user: req.user._id });
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Job application not found.'
      });
    }

    const oldStatus = application.status;
    if (oldStatus !== status) {
      application.stageHistory.push({
        fromStatus: oldStatus,
        toStatus: status,
        changedAt: new Date()
      });
      application.status = status;
    }

    if (status === 'rejected') {
      application.rejectionReason = {
        category: rejectionCategory || application.rejectionReason?.category || 'other',
        details: (rejectionDetails !== undefined ? rejectionDetails : application.rejectionReason?.details || '').trim()
      };
    }

    await application.save();

    lifeScoreService.calculateDailyScore(req.user._id).catch(() => {});

    res.status(200).json({
      success: true,
      message: `Status moved to ${status}.`,
      application
    });
  } catch (error) {
    console.error('Error in updateApplicationStatus:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update application status.'
    });
  }
};

/**
 * 5. Delete Job Application
 */
const deleteJobApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await JobApplication.findOneAndDelete({ _id: id, user: req.user._id });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Job application not found.'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Job application deleted successfully.'
    });
  } catch (error) {
    console.error('Error in deleteJobApplication:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete job application.'
    });
  }
};

/**
 * 6. Bulk Import Job Applications (with Resilient Duplicate Upsert Guard)
 */
const bulkImportJobApplications = async (req, res) => {
  try {
    const { items = [] } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Import payload must contain an array of job application rows.'
      });
    }

    // Fetch user's existing applications for duplicate matching
    const existingApps = await JobApplication.find({ user: req.user._id });
    const existingMap = new Map();
    existingApps.forEach((app) => {
      const key = `${(app.company || '').trim().toLowerCase()}|${(app.roleTitle || '').trim().toLowerCase()}`;
      existingMap.set(key, app);
    });

    let importedCount = 0;
    let updatedCount = 0;
    const validStatusList = ['wishlist', 'applied', 'interviewing', 'offer', 'rejected', 'archived'];
    const validTypeList = ['full_time', 'part_time', 'contractual', 'internship', 'freelance'];
    const validLocationList = ['remote', 'hybrid', 'onsite'];
    const validPriorityList = ['high', 'medium', 'low'];
    const validSourceList = ['linkedin', 'bdjobs', 'company_website', 'referral', 'facebook', 'other'];

    for (const raw of items) {
      const company = (raw.company || raw.companyName || raw['Company Name'] || raw['Company'] || '').trim();
      const roleTitle = (raw.roleTitle || raw.jobTitle || raw.role || raw['Job Title / Role'] || raw['Job Title'] || '').trim();

      if (!company || !roleTitle) {
        continue; // skip empty/invalid rows
      }

      const matchKey = `${company.toLowerCase()}|${roleTitle.toLowerCase()}`;

      // Normalize fields
      const appliedDate = raw.appliedDate || raw['Applied Date'] ? new Date(raw.appliedDate || raw['Applied Date']) : new Date();
      const followUpDate = raw.followUpDate || raw['Follow-up Date']
        ? new Date(raw.followUpDate || raw['Follow-up Date'])
        : new Date(appliedDate.getTime() + 7 * 24 * 60 * 60 * 1000);

      const rawStatus = (raw.status || raw['Status'] || 'applied').toLowerCase().trim();
      const status = validStatusList.includes(rawStatus) ? rawStatus : 'applied';

      const rawType = (raw.jobType || raw['Job Type'] || 'full_time').toLowerCase().replace('-', '_').trim();
      const jobType = validTypeList.includes(rawType) ? rawType : 'full_time';

      const rawLocation = (raw.location || raw['Location'] || 'remote').toLowerCase().trim();
      const location = validLocationList.includes(rawLocation) ? rawLocation : 'remote';

      const rawPriority = (raw.priority || raw['Priority'] || 'medium').toLowerCase().trim();
      const priority = validPriorityList.includes(rawPriority) ? rawPriority : 'medium';

      const rawSource = (raw.source || raw['Source'] || 'linkedin').toLowerCase().trim();
      const source = validSourceList.includes(rawSource) ? rawSource : 'linkedin';

      const salaryRange = (raw.salaryRange || raw['Salary Range'] || '').trim();
      const jobUrl = (raw.jobUrl || raw['Job Link'] || '').trim();
      const contactEmail = (raw.contactEmail || raw['Contact Email'] || '').trim().toLowerCase();
      const jobDescription = (raw.jobDescription || raw['Job Description'] || raw.description || '').trim();
      const notes = (raw.notes || raw['Notes'] || '').trim();

      const networkingName = (raw.networkingName || raw['Networking Contact'] || raw.networkingContact || '').trim();
      const networkingUrl = (raw.networkingUrl || raw.profileUrl || '').trim();

      const existingRecord = existingMap.get(matchKey);

      if (existingRecord) {
        // Smart Merge / Update
        if (salaryRange) existingRecord.salaryRange = salaryRange;
        if (jobUrl) existingRecord.jobUrl = jobUrl;
        if (contactEmail) existingRecord.contactEmail = contactEmail;
        if (jobDescription) existingRecord.jobDescription = jobDescription;
        if (notes) existingRecord.notes = notes;
        if (status !== existingRecord.status) {
          existingRecord.stageHistory.push({
            fromStatus: existingRecord.status,
            toStatus: status,
            changedAt: new Date()
          });
          existingRecord.status = status;
        }
        await existingRecord.save();
        updatedCount++;
      } else {
        // Create New Record
        const newDoc = new JobApplication({
          user: req.user._id,
          company,
          roleTitle,
          appliedDate,
          followUpDate,
          priority,
          jobType,
          source,
          jobUrl,
          status,
          salaryRange,
          location,
          contactEmail,
          networking: {
            personName: networkingName,
            profileUrl: networkingUrl
          },
          jobDescription,
          notes,
          stageHistory: [
            {
              fromStatus: 'imported',
              toStatus: status,
              changedAt: new Date()
            }
          ]
        });
        await newDoc.save();
        existingMap.set(matchKey, newDoc);
        importedCount++;
      }
    }

    lifeScoreService.calculateDailyScore(req.user._id).catch(() => {});

    res.status(200).json({
      success: true,
      message: `Bulk import completed: ${importedCount} new applications imported, ${updatedCount} existing records updated.`,
      importedCount,
      updatedCount,
      totalProcessed: items.length
    });
  } catch (error) {
    console.error('Error in bulkImportJobApplications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk import job applications.'
    });
  }
};

/**
 * 7. Pipeline Conversion Funnel & Executive Stats
 */
const getPipelineStats = async (req, res) => {
  try {
    const applications = await JobApplication.find({ user: req.user._id });

    const total = applications.length;
    let wishlistCount = 0;
    let appliedCount = 0;
    let interviewingCount = 0;
    let offerCount = 0;
    let rejectedCount = 0;
    let followUpDueCount = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    applications.forEach((app) => {
      if (app.status === 'wishlist') wishlistCount++;
      else if (app.status === 'applied') {
        appliedCount++;
        if (app.followUpDate && new Date(app.followUpDate) <= today) {
          followUpDueCount++;
        }
      } else if (app.status === 'interviewing') interviewingCount++;
      else if (app.status === 'offer') offerCount++;
      else if (app.status === 'rejected') rejectedCount++;
    });

    const activePipelineCount = appliedCount + interviewingCount + offerCount;
    const interviewConversionRate = appliedCount > 0 ? Math.round((interviewingCount / appliedCount) * 100) : 0;
    const offerConversionRate = interviewingCount > 0 ? Math.round((offerCount / interviewingCount) * 100) : 0;

    res.status(200).json({
      success: true,
      stats: {
        total,
        wishlistCount,
        appliedCount,
        interviewingCount,
        offerCount,
        rejectedCount,
        activePipelineCount,
        followUpDueCount,
        interviewConversionRate,
        offerConversionRate
      }
    });
  } catch (error) {
    console.error('Error in getPipelineStats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate pipeline statistics.'
    });
  }
};

module.exports = {
  getJobApplications,
  createJobApplication,
  updateJobApplication,
  updateApplicationStatus,
  deleteJobApplication,
  bulkImportJobApplications,
  getPipelineStats
};
