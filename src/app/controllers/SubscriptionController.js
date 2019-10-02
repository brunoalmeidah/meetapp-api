import * as Yup from 'yup';
import { Op } from 'sequelize';
import { startOfHour, endOfHour } from 'date-fns';
import Subscription from '../models/Subscription';
import Meetup from '../models/Meetup';
import User from '../models/User';
import Mail from '../../lib/Mail';

class SubscriptionController {
  async index(req, res) {
    const mySubscriptions = await Subscription.findAll({
      where: {
        user_id: req.userId,
      },
      attributes: ['meetup_id'],
      include: [
        {
          model: Meetup,
          as: 'meetup',
          attributes: ['title', 'description', 'localization', 'date'],
          where: { date: { [Op.gt]: new Date() } },
        },
      ],
      order: [[{ model: Meetup, as: 'meetup' }, 'date']],
    });
    return res.json(mySubscriptions);
  }

  async store(req, res) {
    const schema = Yup.object().shape({
      meetup_id: Yup.number().required(),
    });

    if (!(await schema.isValid(req.body))) {
      return res.status(400).json({ error: 'Validation fails' });
    }
    const user_id = req.userId;
    const { meetup_id } = req.body;

    const meetup = await Meetup.findByPk(meetup_id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['name', 'email'],
        },
      ],
    });

    if (meetup.user_id === user_id || meetup.done) {
      return res
        .status(400)
        .json({ error: 'You cannot subscribe for this meetup' });
    }

    const sameSubscription = await Subscription.findOne({
      where: {
        user_id,
        meetup_id,
      },
    });

    if (sameSubscription) {
      return res
        .status(400)
        .json({ error: 'You cannot subscribe for this meetup again' });
    }

    const haveMeetupInSameHour = await Subscription.findOne({
      where: { user_id },
      include: [
        {
          model: Meetup,
          as: 'meetup',
          where: {
            date: {
              [Op.between]: [startOfHour(meetup.date), endOfHour(meetup.date)],
            },
          },
        },
      ],
    });

    if (haveMeetupInSameHour) {
      return res
        .status(400)
        .json({ error: 'You cannot subscribe for this meetup.' });
    }
    const subscription = await Subscription.create({
      user_id,
      meetup_id,
    });

    const { name, email } = await User.findByPk(user_id, {
      attributes: ['name', 'email'],
    });

    Mail.sendMail({
      to: `${meetup.user.name} <${meetup.user.email}>`,
      subject: 'Nova inscrição',
      template: 'subscription',
      context: {
        organizer: meetup.user.name,
        name,
        email,
      },
    });

    return res.json(subscription);
  }
}

export default new SubscriptionController();
