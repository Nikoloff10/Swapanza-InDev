import os
from celery import Celery
from django.conf import settings

# Set the default Django settings module for the 'celery' program.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'swapanzaBackend.settings')

app = Celery('swapanzaBackend')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django app configs.
app.autodiscover_tasks()

# Define the beat schedule directly here (in addition to what's in settings)
app.conf.beat_schedule = {
    # This task will run every 10 seconds to check for expired Swapanza sessions
    'check-expired-swapanzas': {
        'task': 'chat.tasks.check_expired_swapanzas',
        'schedule': 10.0,  # Run every 10 seconds for faster detection
    },
}

@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')