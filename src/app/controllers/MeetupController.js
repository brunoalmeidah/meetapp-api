import { parseISO, isBefore, startOfDay, endOfDay } from 'date-fns';
import * as Yup from 'yup';
import { Op } from 'sequelize';
import Meetup from '../models/Meetup';
import User from '../models/User';
import File from '../models/File';

class MeetupController {
  async index(req, res) {
    const { date, page } = req.query;
    const limit = 10;
    const meetups = await Meetup.findAll({
      where: {
        date: {
          [Op.between]: [startOfDay(parseISO(date)), endOfDay(parseISO(date))],
        },
      },
      attributes: ['id', 'title', 'description', 'localization', 'date'],
      include: [{ model: User, as: 'user', attributes: ['name', 'email'] }],
      offset: (page - 1) * limit,
      limit,
    });
    return res.json(meetups);
  }

  async store(req, res) {
    const schema = Yup.object().shape({
      title: Yup.string().required(),
      description: Yup.string().required(),
      localization: Yup.string().required(),
      date: Yup.date().required(),
      image_id: Yup.number().required(),
      user_id: Yup.number().required(),
    });

    if (!(await schema.isValid(req.body))) {
      return res.status(400).json({ error: 'Validation fails' });
    }
    const { date } = req.body;
    if (isBefore(parseISO(date), new Date())) {
      return res.status(400).json({ error: 'Cannot be past date' });
    }

    const { id } = await Meetup.create(req.body);

    const meetup = await Meetup.findByPk(id, {
      attributes: ['id', 'title', 'description', 'date', 'localization'],
      include: [
        { model: File, as: 'image', attributes: ['id', 'path', 'url'] },
      ],
    });

    return res.json(meetup);
  }

  async update(req, res) {
    const schema = Yup.object().shape({
      title: Yup.string().required(),
      description: Yup.string().required(),
      localization: Yup.string().required(),
      date: Yup.date().required(),
      image_id: Yup.number().required(),
    });

    if (!(await schema.isValid(req.body))) {
      return res.status(400).json({ error: 'Validation fails' });
    }

    const meetup = await Meetup.findByPk(req.params.id);

    if (!meetup) {
      return res.status(401).json({ error: 'Meetup not found' });
    }
    if (meetup.user_id !== req.userId) {
      return res.status(401).json({ error: 'You cannot edit this meetup' });
    }

    if (meetup.done) {
      return res.status(400).json({ error: 'Unable to edit this meetup' });
    }

    if (isBefore(parseISO(req.body.date), new Date())) {
      return res.status(400).json({ error: 'Cannot be past date' });
    }

    const { id } = await meetup.update(req.body);
    const meetupUpdatted = await Meetup.findByPk(id, {
      attributes: ['id', 'title', 'description', 'date', 'localization'],
      include: [
        { model: File, as: 'image', attributes: ['id', 'path', 'url'] },
      ],
    });

    return res.json(meetupUpdatted);
  }

  async delete(req, res) {
    const meetup = await Meetup.findByPk(req.params.id);

    if (meetup.done) {
      return res.status(400).json({ error: 'Cannot cancel this meetup' });
    }
    if (meetup.user_id !== req.userId) {
      return res.status(401).json({
        error: 'Cannot cancel this meetup, because you are not the organizer',
      });
    }
    await meetup.destroy();

    return res.json({ message: 'Meetup successfully canceled' });
  }
}

export default new MeetupController();
