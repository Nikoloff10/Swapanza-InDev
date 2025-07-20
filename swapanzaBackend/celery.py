import os
from celery import Celery
from django.conf import settings


os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'swapanzaBackend.settings')

app = Celery('swapanzaBackend')



app.config_from_object('django.conf:settings', namespace='CELERY')


app.autodiscover_tasks()


app.conf.beat_schedule = {
    
    'check-expired-swapanzas': {
        'task': 'chat.tasks.check_expired_swapanzas',
        'schedule': 10.0,  
    },
}

@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')