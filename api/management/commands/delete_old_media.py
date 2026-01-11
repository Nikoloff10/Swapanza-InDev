from django.core.management.base import BaseCommand
import os
from django.conf import settings

class Command(BaseCommand):
    help = 'Cleanup local profile images after moving to Cloudinary'

    def handle(self, *args, **options):
        media_path = os.path.join(settings.MEDIA_ROOT, 'profile_images')
        
        if os.path.exists(media_path):
            for file in os.listdir(media_path):
                file_path = os.path.join(media_path, file)
                try:
                    if os.path.isfile(file_path):
                        os.unlink(file_path)
                        self.stdout.write(self.style.SUCCESS(f'Deleted {file_path}'))
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f'Error deleting {file_path}: {e}'))
        
        self.stdout.write(self.style.SUCCESS('Local profile images cleanup completed'))